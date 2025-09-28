import { AutoRouter } from 'itty-router';

interface Paste {
	content: string;
	created_at: number;
	ttl: undefined | number;
}

function randomId(length = 4) {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (x) => chars[x % chars.length]).join('');
}

const router = AutoRouter();
router
	.get(
		'/',
		(_, env: Env) =>
			new Response(`PB(1)			General Commands manual			PB(1)

NAME
	pb - simple pastebin

EXAMPLES
	Upload some text:
		$ curl -F 'c=<text>' ${env.HOSTNAME}

	Upload a file:
		$ curl -F 'c=@<file>' ${env.HOSTNAME}

	Or use it in a pipe:
		$ cmd | curl -F 'c=@-' ${env.HOSTNAME}

	HTML Form:
		Open ${new URL('/form', env.HOSTNAME).toString()} in a web browser.

AUTHORS
	ElmF <elmforestw@proton.me>

COPYRIGHT
	Copyright (c) 2025 ElmF. License MIT.

SEE ALSO
	https://github.com/ElmForestW/pb

			September 2025				PB(1)`),
	)
	.get(
		'/form',
		() =>
			new Response(
				`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>pb - HTML Form</title>
  </head>
  <body>
    <form action="/" method="post">
      <textarea name="c" rows="10" cols="50"></textarea><br>
      <label for="ttl">ttl</label>
      <input name="ttl" type="number">
      <input type="submit" value="paste">
    </form>
  </body>
  <style>
    body {
      font-family: sans-serif;
    }
    label {
      display: block;
    }
  </style>
</html>`,
				{
					headers: {
						'Content-Type': 'text/html; charset=UTF-8',
					},
				},
			),
	)
	.post('/', async (request, env: Env) => {
		const MAX_RETRIES = 10;
		let k: string;
		let attempts = 0;

		// get form data
		const data = await request.formData();
		const input = data.get('c');
		if (!input || (typeof input === 'string' && !input.trim())) {
			return new Response('bad request, invalid input', { status: 400 });
		}
		const rawTtl = data.get('ttl');
		let ttl: number | undefined;

		if (typeof rawTtl === 'string' && rawTtl !== '') {
			const n = parseInt(rawTtl, 10);
			if (Number.isNaN(n)) {
				return new Response('bad request, invalid ttl', { status: 400 });
			}
			if (n < 60) {
				return new Response('bad request, ttl must be > 60', { status: 400 });
			}
			ttl = n;
		}

		// read input content
		let v: string;
		if (input instanceof File) {
			v = await input.text();
		} else if (typeof input === 'string') {
			v = input;
		} else {
			return new Response('unsupported input', { status: 400 });
		}

		// generate unique ID with retries
		do {
			k = randomId();
			attempts++;
		} while ((await env.PASTES.get(k)) && attempts < MAX_RETRIES);

		if (attempts === MAX_RETRIES) {
			return new Response('collision detected, is the random id range near exhaust?', { status: 500 });
		}

		// create paste object
		const paste: Paste = {
			content: v,
			created_at: Date.now(),
			ttl: ttl,
		};

		// store in KV
		await env.PASTES.put(k, JSON.stringify(paste), { expirationTtl: ttl });

		// return response without content
		const result = { id: k, created_at: paste.created_at, ttl: ttl ? ttl : 'does not expire', url: `${env.HOSTNAME}/${k}` };
		return new Response(JSON.stringify(result, null, 2), {
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
		});
	})
	.get('/:id', async (request, env: Env) => {
		// check if using JSON
		const url = new URL(request.url);
		const json = url.searchParams.get('json') === 'true';

		// fetch paste
		const stored = await env.PASTES.get(request.id!);
		if (!stored) return new Response('paste not found', { status: 404 });

		// return paste
		const paste = JSON.parse(stored);
		return !json
			? new Response(paste.content)
			: Response.json({
				id: request.id,
				content: paste.content,
				created_at: paste.created_at,
			});
	});

export default { ...router };
