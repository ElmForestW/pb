import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('pb worker', () => {
	it('root', async () => {
		const request = new IncomingRequest('http://example.com');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`
			"PB(1)			General Commands manual			PB(1)

			NAME
				pb - simple pastebin

			EXAMPLES
				Upload some text:
					$ curl -F 'c=<text>' https://pb.elmf.me

				Upload a file:
					$ curl -F 'c=@<file>' https://pb.elmf.me

				Or use it in a pipe:
					$ cmd | curl -F 'c=@-' https://pb.elmf.me

				HTML Form:
					Open https://pb.elmf.me/form in a web browser.

			AUTHORS
				ElmF <elmforestw@proton.me>

			COPYRIGHT
				Copyright (c) 2025 ElmF. License MIT.

			SEE ALSO
				https://github.com/ElmForestW/pb

						September 2025				PB(1)"
		`);
	});
});
