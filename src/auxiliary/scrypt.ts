const stringToUTF8Bytes = (s: string): number[] => {
	var arr = [];
	for (var i = 0; i < s.length; i++) {
		var c = s.charCodeAt(i);
		if (c < 0x80) {
			arr.push(c);
		} else if (c < 0x800) {
			arr.push(0xc0 | (c >> 6));
			arr.push(0x80 | (c & 0x3f));
		} else if (c < 0xd800) {
			arr.push(0xe0 | (c >> 12));
			arr.push(0x80 | ((c >> 6) & 0x3f));
			arr.push(0x80 | (c & 0x3f));
		} else {
			if (i >= s.length - 1) {
				throw new Error('invalid string');
			}
			i++; // get one more character
			c = (c & 0x3ff) << 10;
			c |= s.charCodeAt(i) & 0x3ff;
			c += 0x10000;

			arr.push(0xf0 | (c >> 18));
			arr.push(0x80 | ((c >> 12) & 0x3f));
			arr.push(0x80 | ((c >> 6) & 0x3f));
			arr.push(0x80 | (c & 0x3f));
		}
	}
	return arr;
}

const bytesToHex = (p: number[]): string => {
	/** @const */
	var enc = '0123456789abcdef'.split('');

	var len = p.length,
		arr = [],
		i = 0;

	for (; i < len; i++) {
		arr.push(enc[(p[i] >>> 4) & 15]);
		arr.push(enc[(p[i] >>> 0) & 15]);
	}
	return arr.join('');
}

const bytesToBase64 = (p: number[]): string => {
	/** @const */
	var enc = ('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
        '0123456789+/').split('');

	var len = p.length,
		arr = [],
		i = 0,
		a, b, c, t;

	while (i < len) {
		a = i < len ? p[i++] : 0;
		b = i < len ? p[i++] : 0;
		c = i < len ? p[i++] : 0;
		t = (a << 16) + (b << 8) + c;
		arr.push(enc[(t >>> 3 * 6) & 63]);
		arr.push(enc[(t >>> 2 * 6) & 63]);
		arr.push(enc[(t >>> 1 * 6) & 63]);
		arr.push(enc[(t >>> 0 * 6) & 63]);
	}
	if (len % 3 > 0) {
		arr[arr.length - 1] = '=';
		if (len % 3 === 1) arr[arr.length - 2] = '=';
	}
	return arr.join('');
}

const scrypt = async (password: string, salt: string, N: number, r: number, p: number, dkLen: number): Promise<number[]> => {

	const SHA256 = (m: number[]): number[] => {
		/** @const */ var K = [
			0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
			0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
			0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
			0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
			0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
			0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
			0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
			0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
			0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
			0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
			0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
			0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
			0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
		];

		var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
			h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19,
			w = new Array(64);

		const blocks = (p: number[]): void => {
			var off = 0, len = p.length;
			while (len >= 64) {
				var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7,
					u, i, j, t1, t2;

				for (i = 0; i < 16; i++) {
					j = off + i * 4;
					w[i] = ((p[j] & 0xff) << 24) | ((p[j + 1] & 0xff) << 16) |
                        ((p[j + 2] & 0xff) << 8) | (p[j + 3] & 0xff);
				}

				for (i = 16; i < 64; i++) {
					u = w[i - 2];
					t1 = ((u >>> 17) | (u << (32 - 17))) ^ ((u >>> 19) | (u << (32 - 19))) ^ (u >>> 10);

					u = w[i - 15];
					t2 = ((u >>> 7) | (u << (32 - 7))) ^ ((u >>> 18) | (u << (32 - 18))) ^ (u >>> 3);

					w[i] = (((t1 + w[i - 7]) | 0) + ((t2 + w[i - 16]) | 0)) | 0;
				}

				for (i = 0; i < 64; i++) {
					t1 = ((((((e >>> 6) | (e << (32 - 6))) ^ ((e >>> 11) | (e << (32 - 11))) ^
                        ((e >>> 25) | (e << (32 - 25)))) + ((e & f) ^ (~e & g))) | 0) +
                        ((h + ((K[i] + w[i]) | 0)) | 0)) | 0;

					t2 = ((((a >>> 2) | (a << (32 - 2))) ^ ((a >>> 13) | (a << (32 - 13))) ^
                        ((a >>> 22) | (a << (32 - 22)))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;

					h = g;
					g = f;
					f = e;
					e = (d + t1) | 0;
					d = c;
					c = b;
					b = a;
					a = (t1 + t2) | 0;
				}

				h0 = (h0 + a) | 0;
				h1 = (h1 + b) | 0;
				h2 = (h2 + c) | 0;
				h3 = (h3 + d) | 0;
				h4 = (h4 + e) | 0;
				h5 = (h5 + f) | 0;
				h6 = (h6 + g) | 0;
				h7 = (h7 + h) | 0;

				off += 64;
				len -= 64;
			}
		}

		blocks(m);

		var i, bytesLeft = m.length % 64,
			bitLenHi = (m.length / 0x20000000) | 0,
			bitLenLo = m.length << 3,
			numZeros = (bytesLeft < 56) ? 56 : 120,
			p = m.slice(m.length - bytesLeft, m.length);

		p.push(0x80);
		for (i = bytesLeft + 1; i < numZeros; i++) p.push(0);
		p.push((bitLenHi >>> 24) & 0xff);
		p.push((bitLenHi >>> 16) & 0xff);
		p.push((bitLenHi >>> 8) & 0xff);
		p.push((bitLenHi >>> 0) & 0xff);
		p.push((bitLenLo >>> 24) & 0xff);
		p.push((bitLenLo >>> 16) & 0xff);
		p.push((bitLenLo >>> 8) & 0xff);
		p.push((bitLenLo >>> 0) & 0xff);

		blocks(p);

		return [
			(h0 >>> 24) & 0xff, (h0 >>> 16) & 0xff, (h0 >>> 8) & 0xff, (h0 >>> 0) & 0xff,
			(h1 >>> 24) & 0xff, (h1 >>> 16) & 0xff, (h1 >>> 8) & 0xff, (h1 >>> 0) & 0xff,
			(h2 >>> 24) & 0xff, (h2 >>> 16) & 0xff, (h2 >>> 8) & 0xff, (h2 >>> 0) & 0xff,
			(h3 >>> 24) & 0xff, (h3 >>> 16) & 0xff, (h3 >>> 8) & 0xff, (h3 >>> 0) & 0xff,
			(h4 >>> 24) & 0xff, (h4 >>> 16) & 0xff, (h4 >>> 8) & 0xff, (h4 >>> 0) & 0xff,
			(h5 >>> 24) & 0xff, (h5 >>> 16) & 0xff, (h5 >>> 8) & 0xff, (h5 >>> 0) & 0xff,
			(h6 >>> 24) & 0xff, (h6 >>> 16) & 0xff, (h6 >>> 8) & 0xff, (h6 >>> 0) & 0xff,
			(h7 >>> 24) & 0xff, (h7 >>> 16) & 0xff, (h7 >>> 8) & 0xff, (h7 >>> 0) & 0xff
		];
	}

	const pbkdf2HmacSha256OneIteration = (password: number[], salt: number[], dkLen: number): number[] => {
		// compress password if it's longer than hash block length
		if (password.length > 64) {
			// SHA256 expects password to be an Array. If it's not
			// (i.e. it doesn't have .push method), convert it to one.
			password = SHA256(password.push ? password : Array.prototype.slice.call(password, 0));
		}

		var i, innerLen = 64 + salt.length + 4,
			inner = new Array(innerLen),
			outerKey = new Array(64),
			dk: number[] = [];

		// inner = (password ^ ipad) || salt || counter
		for (i = 0; i < 64; i++) inner[i] = 0x36;
		for (i = 0; i < password.length; i++) inner[i] ^= password[i];
		for (i = 0; i < salt.length; i++) inner[64 + i] = salt[i];
		for (i = innerLen - 4; i < innerLen; i++) inner[i] = 0;

		// outerKey = password ^ opad
		for (i = 0; i < 64; i++) outerKey[i] = 0x5c;
		for (i = 0; i < password.length; i++) outerKey[i] ^= password[i];

		// increments counter inside inner
		const incrementCounter = (): void => {
			for (var i = innerLen - 1; i >= innerLen - 4; i--) {
				inner[i]++;
				if (inner[i] <= 0xff) return;
				inner[i] = 0;
			}
		}

		// output blocks = SHA256(outerKey || SHA256(inner)) ...
		while (dkLen >= 32) {
			incrementCounter();
			dk = dk.concat(SHA256(outerKey.concat(SHA256(inner))));
			dkLen -= 32;
		}
		if (dkLen > 0) {
			incrementCounter();
			dk = dk.concat(SHA256(outerKey.concat(SHA256(inner))).slice(0, dkLen));
		}
		return dk;
	}

	const salsaXOR = (tmp: Uint32Array, B: Uint32Array, bin: number, bout: number): void => {
		var j0 = tmp[0] ^ B[bin++],
			j1 = tmp[1] ^ B[bin++],
			j2 = tmp[2] ^ B[bin++],
			j3 = tmp[3] ^ B[bin++],
			j4 = tmp[4] ^ B[bin++],
			j5 = tmp[5] ^ B[bin++],
			j6 = tmp[6] ^ B[bin++],
			j7 = tmp[7] ^ B[bin++],
			j8 = tmp[8] ^ B[bin++],
			j9 = tmp[9] ^ B[bin++],
			j10 = tmp[10] ^ B[bin++],
			j11 = tmp[11] ^ B[bin++],
			j12 = tmp[12] ^ B[bin++],
			j13 = tmp[13] ^ B[bin++],
			j14 = tmp[14] ^ B[bin++],
			j15 = tmp[15] ^ B[bin++],
			u, i;

		var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7,
			x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14,
			x15 = j15;

		for (i = 0; i < 8; i += 2) {
			u = x0 + x12; x4 ^= (u << 7) | (u >>> (32 - 7));
			u = x4 + x0; x8 ^= (u << 9) | (u >>> (32 - 9));
			u = x8 + x4; x12 ^= (u << 13) | (u >>> (32 - 13));
			u = x12 + x8; x0 ^= (u << 18) | (u >>> (32 - 18));

			u = x5 + x1; x9 ^= (u << 7) | (u >>> (32 - 7));
			u = x9 + x5; x13 ^= (u << 9) | (u >>> (32 - 9));
			u = x13 + x9; x1 ^= (u << 13) | (u >>> (32 - 13));
			u = x1 + x13; x5 ^= (u << 18) | (u >>> (32 - 18));

			u = x10 + x6; x14 ^= (u << 7) | (u >>> (32 - 7));
			u = x14 + x10; x2 ^= (u << 9) | (u >>> (32 - 9));
			u = x2 + x14; x6 ^= (u << 13) | (u >>> (32 - 13));
			u = x6 + x2; x10 ^= (u << 18) | (u >>> (32 - 18));

			u = x15 + x11; x3 ^= (u << 7) | (u >>> (32 - 7));
			u = x3 + x15; x7 ^= (u << 9) | (u >>> (32 - 9));
			u = x7 + x3; x11 ^= (u << 13) | (u >>> (32 - 13));
			u = x11 + x7; x15 ^= (u << 18) | (u >>> (32 - 18));

			u = x0 + x3; x1 ^= (u << 7) | (u >>> (32 - 7));
			u = x1 + x0; x2 ^= (u << 9) | (u >>> (32 - 9));
			u = x2 + x1; x3 ^= (u << 13) | (u >>> (32 - 13));
			u = x3 + x2; x0 ^= (u << 18) | (u >>> (32 - 18));

			u = x5 + x4; x6 ^= (u << 7) | (u >>> (32 - 7));
			u = x6 + x5; x7 ^= (u << 9) | (u >>> (32 - 9));
			u = x7 + x6; x4 ^= (u << 13) | (u >>> (32 - 13));
			u = x4 + x7; x5 ^= (u << 18) | (u >>> (32 - 18));

			u = x10 + x9; x11 ^= (u << 7) | (u >>> (32 - 7));
			u = x11 + x10; x8 ^= (u << 9) | (u >>> (32 - 9));
			u = x8 + x11; x9 ^= (u << 13) | (u >>> (32 - 13));
			u = x9 + x8; x10 ^= (u << 18) | (u >>> (32 - 18));

			u = x15 + x14; x12 ^= (u << 7) | (u >>> (32 - 7));
			u = x12 + x15; x13 ^= (u << 9) | (u >>> (32 - 9));
			u = x13 + x12; x14 ^= (u << 13) | (u >>> (32 - 13));
			u = x14 + x13; x15 ^= (u << 18) | (u >>> (32 - 18));
		}

		B[bout++] = tmp[0] = (x0 + j0) | 0;
		B[bout++] = tmp[1] = (x1 + j1) | 0;
		B[bout++] = tmp[2] = (x2 + j2) | 0;
		B[bout++] = tmp[3] = (x3 + j3) | 0;
		B[bout++] = tmp[4] = (x4 + j4) | 0;
		B[bout++] = tmp[5] = (x5 + j5) | 0;
		B[bout++] = tmp[6] = (x6 + j6) | 0;
		B[bout++] = tmp[7] = (x7 + j7) | 0;
		B[bout++] = tmp[8] = (x8 + j8) | 0;
		B[bout++] = tmp[9] = (x9 + j9) | 0;
		B[bout++] = tmp[10] = (x10 + j10) | 0;
		B[bout++] = tmp[11] = (x11 + j11) | 0;
		B[bout++] = tmp[12] = (x12 + j12) | 0;
		B[bout++] = tmp[13] = (x13 + j13) | 0;
		B[bout++] = tmp[14] = (x14 + j14) | 0;
		B[bout++] = tmp[15] = (x15 + j15) | 0;
	}

	const blockCopy = (dst: Uint32Array, di: number, src: Uint32Array, si: number, len: number): void => {
		while (len--) dst[di++] = src[si++];
	}

	const blockXOR = (dst: Uint32Array, di: number, src: Uint32Array, si: number, len: number): void => {
		while (len--) dst[di++] ^= src[si++];
	}

	const blockMix = (tmp: Uint32Array, B: Uint32Array, bin: number, bout: number, r: number): void => {
		blockCopy(tmp, 0, B, bin + (2 * r - 1) * 16, 16);
		for (var i = 0; i < 2 * r; i += 2) {
			salsaXOR(tmp, B, bin + i * 16, bout + i * 8);
			salsaXOR(tmp, B, bin + i * 16 + 16, bout + i * 8 + r * 16);
		}
	}

	var XY = new Uint32Array(64 * r);
	var V = new Uint32Array(32 * r * N);
	var tmp = new Uint32Array(16);

	var B = pbkdf2HmacSha256OneIteration(stringToUTF8Bytes(password), stringToUTF8Bytes(salt), p * 128 * r);

	var xi = 0, yi = 32 * r;

	const integerify = (B: Uint32Array, bi: number, r: number): number => {
		return B[bi + (2 * r - 1) * 16];
	}

	const smixStart = (pos: number): void => {
		for (var i = 0; i < 32 * r; i++) {
			var j = pos + i * 4;
			XY[xi + i] = ((B[j + 3] & 0xff) << 24) | ((B[j + 2] & 0xff) << 16) |
                ((B[j + 1] & 0xff) << 8) | ((B[j + 0] & 0xff) << 0);
		}
	}

	const smixStep1 = (start: number, end: number): void => {
		for (var i = start; i < end; i += 2) {
			blockCopy(V, i * (32 * r), XY, xi, 32 * r);
			blockMix(tmp, XY, xi, yi, r);

			blockCopy(V, (i + 1) * (32 * r), XY, yi, 32 * r);
			blockMix(tmp, XY, yi, xi, r);
		}
	}

	const smixStep2 = (start: number, end: number): void => {
		for (var i = start; i < end; i += 2) {
			var j = integerify(XY, xi, r) & (N - 1);
			blockXOR(XY, xi, V, j * (32 * r), 32 * r);
			blockMix(tmp, XY, xi, yi, r);

			j = integerify(XY, yi, r) & (N - 1);
			blockXOR(XY, yi, V, j * (32 * r), 32 * r);
			blockMix(tmp, XY, yi, xi, r);
		}
	}

	const smixFinish = (pos: number): void => {
		for (var i = 0; i < 32 * r; i++) {
			var j = XY[xi + i];
			B[pos + i * 4 + 0] = (j >>> 0) & 0xff;
			B[pos + i * 4 + 1] = (j >>> 8) & 0xff;
			B[pos + i * 4 + 2] = (j >>> 16) & 0xff;
			B[pos + i * 4 + 3] = (j >>> 24) & 0xff;
		}
	}




	// Generate key.
	var MAX_UINT = 0x7fffffff;
	if (N < 2 || N > MAX_UINT) {
		throw new Error('scrypt: N is out of range');
	}
	if ((N & (N - 1)) !== 0) {
		throw new Error('scrypt: N is not a power of 2');
	}
	if (p < 1) {
		throw new Error('scrypt: invalid p');
	}

	if (r <= 0) {
		throw new Error('scrypt: invalid r');
	}

	const smix = (i: number): void => {
		smixStart(i * 128 * r);
		smixStep1(0, N);
		smixStep2(0, N);
		smixFinish(i * 128 * r);
	}

	for (let i = 0; i < p; i++) {
		await new Promise((resolve): NodeJS.Timeout => setTimeout((): void => {
			smix(i);
			resolve();
		}, 16))
	}

	return pbkdf2HmacSha256OneIteration(stringToUTF8Bytes(password), B, dkLen);
}

export { scrypt, bytesToBase64, bytesToHex };
