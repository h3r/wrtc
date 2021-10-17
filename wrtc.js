import Peer from 'peerjs'
import cookies from '@h3r/cookies'
import Observable from '@h3r/observable'

export default class WRTC extends Observable 
{
    //debug = 3; //0 none 1 errors 2 errors & warnings 3 all logs
    //peer = null;
    //peers = [];
    //static #instance = null;
    
    constructor(){
        if(WRTC.instance) return WRTC.instance;
        
        super();
        WRTC.instance = this;
        if (util?.supports.data) { /* OK to start a data connection. */ }
        //else { debugger; /* Browser will not support data connection. */ }

        if (util?.browser === 'Firefox') { /* OK to peer with Firefox peers. */ }
        //else { debugger; /* Browser will not support peer with other peers. */ }
        
        return this;
    }

    destructor(){
        //this.peer?.destroy();
        //this.peers?.length = 0;
        //this.options = {};
        //this.metadata = {};
        //this = null;
    }

    isServerConnected(){
        const res = this.peer?.open ?? false;
        if(res && this.debug > 1) console.warn('Net is not connected');
        return res;
    }

    isPeerConnected(peerId){
        const res = this.peers[peerId]?._open ?? false;
        if(res && this.debug > 1) console.warn('Peer is not connected');
        return res;
    }

    async init(UUID = "WRTC", options = {}){
        this.peers = [];
        this.debug = options.debug ?? 3;//0 none 1 errors 2 errors & warnings 3 all logs
        this.metadata = { UUID, ...options.metadata??{} };
        this.peer = await this.createPeer(cookies.get('jsnet_peer_id'), {...options});
        
        return this.peer;
    }

    async createPeer(peerId, options){
        return new Promise((resolve, reject) => {

            if(this.peer?.open) return resolve(false); 
            let success = (peerId)=>{
                cookies.set('jsnet_peer_id',peerId,0);

                //Remove temporal event listeners
                this.peer.off('open',  success);
                this.peer.off('error', destroy);

                //Bind definitive ones
                this.peer.on( 'open',           () => { this.emit("server_open", peerId)} );
                this.peer.on( 'close',          () => { this.emit("server_close"); this.peer.destroy();}  );
                this.peer.on( 'disconnected',   () => { this.emit("server_disconnect"); this.peer.reconnect(); } );
                this.peer.on( 'connection', (conn) => { this.onConnect(peerId, conn)} );
                //this.peer.on( 'call',     (call) => { this.emit("call", call)} );
                this.peer.on( 'error',          (err) => {
                    this.emit("server_error", err);
                    if(this.debug > 0) console.log(`%c[ERROR]%c: %s`,"background-color:red", 'background:transparent;color:white', err);
                });
                
                //Emit event
                this.peer.emit('open', peerId);
                return resolve(this.peer);
            }

            let destroy = () => {
                cookies.set('jsnet_peer_id',null,0);
                this.peer?.destroy();
                this.peer = new Peer(undefined, {...options});
                this.peer.on("open",    success);
                this.peer.on("error",   destroy);
            }

            this.peer = new Peer(cookies.get('jsnet_peer_id'), {...options});
            this.peer.on("open", success);
            this.peer.on("error", destroy);
        });
    }

    connect(dest){
        if(!this.isServerConnected()) return false;
        const conn = this.peer.connect(dest, {metadata: this.metadata});
        conn.on('open',      () => this.onOpen(dest, conn) );
        conn.on('close',     () => this.onClose(dest) );
        conn.on('data',  (data) => this.onData(dest,data) );
        conn.on('error', (err)  => {
            if(this.debug > 2) console.log(`%c[>>OPEN]%c: %s`,"background-color:green", 'background:transparent;color:white', dest);
        });
    }

    onConnect(peerId, conn){
        conn.on('open',      () => this.onOpen(conn.peer, conn));
        conn.on('close',     () => this.onClose(conn.peer));
        conn.on('data',  (data) => this.onData(conn.peer,data));
        conn.on('error', (err)  => {
            if(this.debug > 2) console.log(`%c[<<OPEN]%c: %s`,"background-color:green", 'background:transparent;color:white', conn.peer);
        });
    }

    close(dest){
        if(!this.isPeerConnected(dest)) return false;
        this.peers[dest].close();
        delete this.peers[dest];
        return true;
    }

    send(dest, type, data){
        if(!this.isServerConnected())   return false; 
        if(!this.isPeerConnected(dest)) return false;
        const msg = { type, data }
        this.peers[dest].send(msg);
        if(this.debug > 2) console.log(`%c[>>MSG]%c:`,"background-color:cyan; color:black", 'background:transparent;color:white', msg);

        return true;
    }

    sendAll( message_type, data){
        if(!this.isServerConnected())   return false;
        this.peers.map(peer => this.send(peer.id,message_type, data));
        return true;
    }

    //Emitted when the connection is established and ready-to-use.
    onOpen(peerId, conn){
        if(conn?.metadata?.UUID !== this.metadata?.UUID)
        return this.close(peerId);
        
        this.peers[peerId] = conn;
        this.emit("open", peerId);
        if(this.debug > 2) console.log(`%c[OPEN]%c: %s`,"background-color:green", 'background:transparent;color:white', peerId);
    }
    
    //Emitted when either you or the remote peer closes the data connection.
    onClose(peerId){
        console.log("close",peerId);
        this.emit("close", peerId);
        if(this.debug > 2) console.log(`%c[CLOSE]%c: %s`,"background-color:red", 'background:transparent;color:white', peerId);

    }

    //Emitted when data is received from the remote peer.
    onData(peerId, data){
        this.emit("data",    peerId, data);
        this.emit(data.type, peerId, data);
        if(this.debug > 2) console.log(`%c[<<MSG]%c:`,"background-color:cyan; color:black", 'background:transparent;color:white', data);
    }

    
}