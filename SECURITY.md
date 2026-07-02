# Security Policy

Dearie handles wedding planning data, guest information, invite links, and encrypted recovery material. Please report security issues privately.

## Reporting

Email: yclee913@gmail.com

Please include:

- affected URL or file
- reproduction steps
- expected and actual result
- impact, without accessing or exposing real user data

Do not open a public GitHub issue for vulnerabilities, recovery links, invite links, credentials, or personal data.

## Safe Harbor

Good-faith research is welcome when it avoids:

- accessing, changing, deleting, or exfiltrating another user's data
- denial-of-service or high-volume automated traffic
- social engineering, phishing, spam, or credential attacks
- public disclosure before a fix is available

If you find a problem, stop at the minimum proof needed and contact us privately.

## Production Secrets

Never commit `.env`, `.env.local`, Vercel tokens, Supabase service-role keys, AI API keys, invite recovery links, or owner tokens.

The intended hosted model is end-to-end encrypted: operators should receive ciphertext for wedding data, not plaintext planning content.
