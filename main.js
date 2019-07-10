const Ogario = new(class {
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
})
const Network = new(class {
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
        const opCode = new Reader(data);
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
})
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
const Reader = class {
    constructor(dataView) {
        this.dataView = dataView;
        this.index = 0;
        this.maxIndex = dataView.byteLength;
    }
    readUInt8() {
        const e = this.dataView.getUint8(this.index, true);
        return this.index++, e;
    }
    readInt8() {
        const e = this.dataView.getInt8(this.index, true);
        return this.index++, e;
    }
    readUInt16() {
        const e = this.dataView.getUint16(this.index, true);
        return (this.index += 2), e;
    }
    readInt16() {
        const e = this.dataView.getInt16(this.index, true);
        return (this.index += 2), e;
    }
    readUInt32() {
        const e = this.dataView.getUint32(this.index, true);
        return (this.index += 4), e;
    }
    readInt32() {
        const e = this.dataView.getInt32(this.index, true);
        return (this.index += 4), e;
    }
    readFloat32() {
        const e = this.dataView.getFloat32(this.index, true);
        return (this.index += 4), e;
    }
    readFloat64() {
        const e = this.dataView.getFloat64(this.index, true);
        return (this.index += 8), e;
    }
    readUTF8string() {
        for (
            var e = "", n; !this.endOfBuffer && 0 !== (n = this.readUInt8());

        )
            e += String.fromCharCode(n);
        return e;
    }
    readUTF16string() {
        for (
            var e = "", n; !this.endOfBuffer && 0 !== (n = this.readUInt16());

        )
            e += String.fromCharCode(n);
        return e;
    }
    readEscapedUTF8string() {
        const e = this.readUTF8string();
        return decodeURIComponent(escape(e));
    }
    decompress() {
        const e = new Uint8Array(this.dataView.buffer),
            t = this.readUInt32(),
            i = new Uint8Array(t);
        LZ4.decodeBlock(e.slice(5), i),
            this.dataView = new DataView(i.buffer),
            this.index = 0,
            this.maxIndex = this.dataView.byteLength;
    }
    get endOfBuffer() {
        return this.index >= this.maxIndex;
    }
}
const Writer = class {
    constructor() {
        this.array = []
    }
    writeUInt8(d) {
        return d |= 0,
            0 > d || 255 < d ? void console.error(`value out of range [Min: 0, Max: 255, Value: ${d}]`) : void this.array.push(d);
    }
    writeInt8(d) {
        return d |= 0, -128 > d || 127 < d ? void console.error(`value out of range [Min: -128, Max: 127, Value: ${d}]`) : void this.array.push(d);
    }
    writeUInt16(d) {
        return d |= 0,
            0 > d || 65535 < d ? void console.error(`value out of range [Min: 0, Max: 65535, Value: ${d}]`) : void this.array.push(d, d >> 8);
    }
    writeInt16(d) {
        return d |= 0, -32768 > d || 32767 < d ? void console.error(`value out of range [Min: -32768, Max: 32767, Value: ${d}]`) : void this.array.push(d, d >> 8);
    }
    writeUInt32(d) {
        return d |= 0,
            0 > d || 4294967295 < d ? void console.error(`value out of range [Min: 0, Max: 4294967295, Value: ${d}]`) : void this.array.push(d, d >> 8, d >> 16, d >> 24);
    }
    writeInt32(d) {
        return d |= 0, -2147483648 > d || 2147483647 < d ? void console.error(`value out of range [Min: -2147483648, Max: 2147483647, Value: ${d}]`) : void this.array.push(d, d >> 8, d >> 16, d >> 24);
    }
    writeUTF8string(d) {
        for (let S = 0; S < d.length; S++) {
            const I = d.charCodeAt(S);
            this.writeUInt8(I)
        }
        this.writeUInt8(0)
    }
    writeEncodedUTF8string(d) {
        const S = unescape(encodeURIComponent(d));
        this.writeUTF8string(S)
    }
    writeUTF16StringNonZero(d) {
        for (let S = 0; S < d.length; S++) {
            const I = d.charCodeAt(S);
            this.writeUInt8(I)
        }
    }
    reset() {
        this.array = []
    }
    getbuffer() {
        const d = new Uint8Array(this.array);
        return d.buffer
    }
}