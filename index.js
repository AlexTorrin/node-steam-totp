var Crypto = require('crypto');

/**
 * Returns the current local Unix time
 * @param {number} [timeOffset=0] - This many seconds will be added to the returned time
 * @returns {number}
 */
exports.time = function(timeOffset) {
	return Math.floor(Date.now() / 1000) + (timeOffset || 0);
};

/**
 * Generate a Steam-style TOTP authentication code.
 * @param {Buffer|string} secret - Your TOTP shared_secret as a Buffer, hex, or base64
 * @param {number} [timeOffset=0] - If you know how far off your clock is from the Steam servers, put the offset here in seconds
 * @returns {string}
 */
exports.generateAuthCode = exports.getAuthCode = function(secret, timeOffset) {
	secret = bufferizeSecret(secret);

	var time = exports.time(timeOffset);

	var buffer = new Buffer(8);
	buffer.writeUInt32BE(0, 0); // This will stop working in 2038!
	buffer.writeUInt32BE(Math.floor(time / 30), 4);

	var hmac = Crypto.createHmac('sha1', secret);
	hmac = hmac.update(buffer).digest();

	var start = hmac[19] & 0x0F;
	hmac = hmac.slice(start, start + 4);

	var fullcode = hmac.readUInt32BE(0) & 0x7fffffff;

	var chars = '23456789BCDFGHJKMNPQRTVWXY';

	var code = '';
	for(var i = 0; i < 5; i++) {
		code += chars.charAt(fullcode % chars.length);
		fullcode /= chars.length;
	}

	return code;
};

/**
 * Generate a base64 confirmation key for use with mobile trade confirmations. The key can only be used once.
 * @param {Buffer|string} identitySecret - The identity_secret that you received when enabling two-factor authentication
 * @param {number} time - The Unix time for which you are generating this secret. Generally should be the current time.
 * @param {string} tag - The tag which identifies what this request (and therefore key) will be for. "conf" to load the confirmations page, "details" to load details about a trade, "allow" to confirm a trade, "cancel" to cancel it.
 * @returns {string}
 */
exports.generateConfirmationKey = exports.getConfirmationKey = function(identitySecret, time, tag) {
	identitySecret = bufferizeSecret(identitySecret);

	var dataLen = 8;

	if(tag) {
		if(tag.length > 32) {
			dataLen += 32;
		} else {
			dataLen += tag.length;
		}
	}

	var buffer = new Buffer(dataLen);
	buffer.writeUInt32BE(0, 0); // This will stop working in 2038!
	buffer.writeUInt32BE(time, 4);

	if(tag) {
		buffer.write(tag, 8);
	}

	var hmac = Crypto.createHmac('sha1', identitySecret);
	return hmac.update(buffer).digest('base64');
};

function bufferizeSecret(secret) {
	if(typeof secret === 'string') {
		// Check if it's hex
		if(secret.match(/[0-9a-f]{40}/i)) {
			return new Buffer(secret, 'hex');
		} else {
			// Looks like it's base64
			return new Buffer(secret, 'base64');
		}
	}

	return secret;
}
