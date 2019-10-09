exports.bServeAsHub = false;
exports.bLight = true;
exports.bSingleAddress = true;

exports.WS_PROTOCOL = "wss://";
exports.hub = process.env.testnet ? 'obyte.org/bb-test' : 'obyte.org/bb';
exports.deviceName = 'AA-channel-lib';
exports.permanent_pairing_secret = '0000';
exports.control_addresses = [''];

exports.minChannelTimeoutInSecond = 600;
exports.maxChannelTimeoutInSecond = 1000;
exports.defaultTimeoutInSecond = 600;

exports.unconfirmedAmountsLimitsByAssetOrChannel = {
	"base": {
		max_unconfirmed_by_asset: 10000000,
		max_unconfirmed_by_channel: 10000000,
		minimum_time_in_second: 1
	},
	"Clcb6ZC5br93OA7ZMFEq88i+1CkJtpxpyAz4WyinKBY=": {
		max_unconfirmed_by_asset: 10000000,
		max_unconfirmed_by_channel: 10000000,
		minimum_time_in_second: 1
	}
};

exports.enabledReceivers = ['obyte-messenger'];

exports.httpDefaultPort = 6800;

console.log('finished AA-channel-lib conf');
