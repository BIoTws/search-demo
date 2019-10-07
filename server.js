const koa = require('koa');
const app = new koa();
const Route = require('e.router')();
const render = require('koa-ejs');
const IO = require('koa-socket-2');
const serve = require('koa-static');
const io = new IO();
const faker = require('faker');

const crypto = require("crypto");

let assocAAtoSearch = {};

const channels = require('biot-core/channels');
const eventBus = require('ocore/event_bus');
const core = require('biot-core');
const db = require('ocore/db');


core.init('test').then(() => {
	eventBus.emit('biot_ok');
	db.query("CREATE TABLE IF NOT EXISTS sessions_search (\n\
	session CHAR(40) NOT NULL, \n\
	aa_address CHAR(32) NOT NULL, \n\
	device_address CHAR(33) NOT NULL,\n\
	UNIQUE(session, aa_address))");
});

function sha1(data) {
	return crypto.createHash("sha1").update(data.toString()).digest("hex");
}

let list = [];
for (let i = 0; i < 500; i++) {
	list.push(faker.name.findName());
}

app.use(serve('./s/'));

render(app, {
	root: __dirname,
	layout: false,
	viewExt: 'html',
	cache: false,
	debug: false
});

io.attach(app);

let tmpSession = {};

async function sendStats(socket, session) {
	let rows = await db.query("SELECT * FROM sessions_search WHERE session=?", [session]);
	console.error('rows', rows);
	if (rows.length) {
		let stats = {
			balance: 0,
			cost: 100,
			done: 0,
			paid: 0
		};
		let rows1 = await db.query("SELECT amount_deposited_by_peer, amount_spent_by_peer FROM aa_channels WHERE aa_channels.aa_address = ?", [rows[0].aa_address]);
		let rows2 = await db.query("SELECT SUM(amount) AS amount FROM aa_unconfirmed_units_from_peer WHERE aa_address = ? GROUP BY aa_address", [rows[0].aa_address]);
		let balance = 0;
		balance += rows1[0].amount_deposited_by_peer;
		if (rows2.length) balance += rows2[0].amount;
		balance -= rows1[0].amount_spent_by_peer;
		stats.balance = balance;
		stats.done = rows1[0].amount_spent_by_peer / stats.cost;
		stats.paid = rows1[0].amount_spent_by_peer;
		socket.emit('stats', stats);
	}
}

io.on('connection', function (socket) {
	let session = sha1(Date.now() + socket.id);
	console.error('connection');
	socket.emit('your_session', session);
	tmpSession[session] = socket;

	socket.on('my_session', async msg => {
		delete tmpSession[session];
		session = msg;
		tmpSession[session] = socket;
		sendStats(socket, session);
	});

	socket.on('close', async () => {
		let rows = await db.query("SELECT device_address, aa_address FROM sessions_search WHERE session=?", [session]);
		if (rows.length) {
			channels.close(rows[0].aa_address, console.error);
		}
	});

	socket.on('search', async (msg) => {
		let rows = await db.query("SELECT device_address, aa_address FROM sessions_search WHERE session=?", [session]);
		if (rows.length) {
			core.sendTechMessageToDevice(rows[0].device_address, {
				type: 'reqPayment',
				aa_address: rows[0].aa_address,
				amount: 100
			});
			assocAAtoSearch[rows[0].aa_address] = msg;
		} else {
			socket.emit('result', []);
		}
	});

	socket.on('disconnected', function () {
		delete tmpSession[session];
	});
});

Route.get('/', async (ctx, next) => {
	await ctx.render('index')
});


app.use(Route.R());
app.listen(3000);

channels.setCallBackForPaymentReceived(async (amount, asset, message, aa_address, handle) => {
	if (amount === 100) {
		let rows = await db.query("SELECT session FROM sessions_search WHERE aa_address=?", [aa_address]);
		if (rows.length) {
			let session = rows[0].session;
			tmpSession[session].emit('result', list.filter(v => {
				return v.toLowerCase().match(new RegExp(assocAAtoSearch[aa_address]));
			}));
			sendStats(tmpSession[session], session);
		}
		delete assocAAtoSearch[aa_address];
	}
	return handle(null, 'ok');
});

eventBus.on('object', async (device_address, object) => {
	console.error("_____________________________________________________________________________________________________________________", object, "_____________________________________________________________________________________________________________________");
	if (object.type === 'message_from_channel' && tmpSession[object.message]) {
		await db.query("INSERT INTO sessions_search (session, aa_address, device_address) VALUES (?,?,?)", [object.message, object.aa_address, device_address]);
		console.error('save_session');
		tmpSession[object.message].emit('save_session');
		setTimeout(() => sendStats(tmpSession[object.message], object.message), 2000);
		console.error('object', device_address, object);
	}
});

eventBus.on("channel_created_by_peer", function (peer_payment_address, aa_address) {
	console.error('channel_created_by_peer', peer_payment_address, aa_address);
});
eventBus.on("channel_refilled", function (aa_address, amount) {
	console.error('channel_refilled', aa_address, amount);
});
eventBus.on("my_deposit_became_stable", function (amount, unit) {
	console.error('my_deposit_became_stable', amount, unit);
});
eventBus.on("peer_deposit_became_stable", function (amount, deposit_unit) {
	console.error('peer_deposit_became_stable', amount, deposit_unit);
});
eventBus.on("channel_closed_with_fraud_proof", function (aa_address, amount_received_at_closing) {
	console.error('channel_closed_with_fraud_proof', aa_address, amount_received_at_closing);
});
eventBus.on("channel_closed", function (aa_address, amount_received_at_closing) {
	console.error('channel_closed', aa_address, amount_received_at_closing);
});
eventBus.on("refused_deposit", function (deposit_unit) {
	console.error('refused_deposit', deposit_unit);
});