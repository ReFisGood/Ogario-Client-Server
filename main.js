const Ogario = new class {
    constructor() {
        this.serverURL = 'srv.ogario.eu';
        this.ogario = null;
    }
    connect() {
        this.ogario = new WebSocket(`wss://` + this.serverURL);
        this.ogario.binaryType = "arraybuffer";
        this.ogario.onopen = () => this.open();
        this.ogario.onmessage = n => this.handleMessage(n);
        this.ogario.onclose = () => this.close();
        this.ogario.onerror = () => this.error();
        console.log(`[Ogario] Connecting to Ogario Networks.`);
    }
    send(e) {
        this.ogario.send(e.buffer);
    }
    open() {
        Network.init();
        console.log(`[Ogario] Connected to Ogario Networks.`);
    }
    handleMessage(e) {
        Network.parse(e);
    }
    close() {
        console.log("[Ogario] Disconnect...");
    }
    error() {
        console.log(`[Ogario] Connection to Ogario server errored out!`);
    }
    isConnected() {
        return (
            this.ogario && this.ogario.readyState === this.ogario.OPEN
        );
    }
}
const Network = new class {
    constructor() {
        this.version = 401;
        this.selfID = 0;
        this.players = new Map();
    }
    init() {
        this.handShake();
        this.joinRoom();
        this.tag();
        this.nick();
    }
    handShake() {
        let buf = new Writer();
        buf.writeUInt8(0);
        buf.writeUInt16(this.version);
        Ogario.send(buf)
    }
    sendOption(offset, str) {
        if (Ogario.isConnected()) {
            let buf = new Writer();
            buf.writeUInt8(offset);
            buf.writeUTF16StringNonZero(str);
            Ogario.send(buf);
        }
    }
    tag() {
        this.sendOption(12, Player.tag);
    }
    nick() {
        this.sendOption(10, Player.nick);
    }
    joinRoom() {
        this.sendOption(16, Player.roomCode);
    }
    parse(data) {
        data = new DataView(data.data);
        const opCode = new Reader().init(data);
        switch (opCode.readUInt8()) {
            case 0:
                this.selfID = opCode.readUInt32();
                break;
            case 20:
                this.updateTeam(opCode);
                break;
            case 30:
                this.updateTeamPosition(opCode);
                break;
            case 100:
                this.message(opCode);
        }
    }
    updateTeam(data) {
        const id = data.readUInt32();
        const player = this.getPlayer(id);
        player.nick = data.readUTF16string();
        player.skin = data.readUTF16string();
        data.readUTF16string();
        player.color = data.readUTF16string();
    }
    updateTeamPosition(data) {
        const id = data.readUInt32();
        const player = this.getPlayer(id);
        player.x = data.readInt32();
        player.y = data.readInt32();
        player.mass = data.readUInt32();
        player.updateTime = Date.now();
    }
    message(data) {
        const type = data.readUInt8();
        const player = (data.readUInt32(), data.readUInt32(), data.readUTF16string().split(": "));
        const author = player[0];
        const message = player[1];
        101 === type ?
            chatRoom.receiveMessage(author, message, false) :
            102 === type && chatRoom.receiveMessage(author, message, true);
    }
    getPlayer(id) {
        return id === this.selfID ? {} :
            this.players.get(id) || this.setPlayerId(id);
    }
    setPlayerId(id) {
        const newPlayer = Player.setID(id);
        return this.players.set(id, newPlayer), newPlayer;
    }
}
const Player = new class {
    constructor() {
        this.id = "";
        this.tag = "";
        this.nick = "";
        this.roomCode = "";
    }
    setID(id) {
        this.id = id;
    }
}

class Writer {
    init() {
        this.buffer = [];
        this.length = 0;
    }

    writeUInt8(value) {
        this.length++;
        this.buffer.push({ method: 'setUint8', value, offset: 1 });
    }

    writeUInt16(value) {
        this.length += 2;
        this.buffer.push({ method: 'setUint16', value, offset: 2 });
    }

    writeUInt32(value) {
        this.length += 4;
        this.buffer.push({ method: 'setUint32', value, offset: 4 });
    }

    writeString8(value) {
        const strLength = value.length;
        this.writeUInt8(strLength);
        for (let i = 0; i < strLength; ++i) {
            const charCode = value.charCodeAt(i);
            this.writeUInt8(charCode);
        }
    }

    writeString16(value) {
        const strLength = value.length;
        this.writeUInt8(strLength);
        for (let i = 0; i < strLength; ++i) {
            const charCode = value.charCodeAt(i);
            this.writeUInt16(charCode);
        }
    }

    get data() {
        const arraybuffer = new ArrayBuffer(this.length);
        const view = new DataView(arraybuffer);
        let offset = 0;

        for (const data of this.buffer) {
            view[data.method](offset, data.value, true);
            offset += data.offset;
        }

        return view;
    }
}

class Reader {
    init(buffer) {
        this.buffer = buffer;
        this.index = 0;
    }

    readUInt8() {
        const value = this.buffer.getUint8(this.index, true);
        this.index++;
        return value;
    }

    readUInt16() {
        const value = this.buffer.getUint16(this.index, true);
        this.index += 2;
        return value;
    }

    readUInt32() {
        const value = this.buffer.getUint32(this.index, true);
        this.index += 4;
        return value;
    }

    readString8() {
        let string = '';
        const length = this.readUInt8();
        for (let i = 0; i < length; ++i) {
            const value = this.readUInt8();
            string += String.fromCharCode(value);
        }
        return string;
    }

    readString16() {
        let string = '';
        const length = this.readUInt8();
        for (let i = 0; i < length; ++i) {
            const value = this.readUInt16();
            string += String.fromCharCode(value);
        }
        return string;
    }
}