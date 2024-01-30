rd https://github.com/luxysiv/Cloudflare-Gateway-Pihole

**[English](README.md)** | **[Việt Nam](docs/vi.md)**

# Pihole styled, but using Cloudflare Gateway
`For Devs, Ops, and everyone who hates Ads.`

Create your ad blocklist using Cloudflare Gateway

### How to set this up?
---
1. Fork this repository to your account.
2. Grab your **Cloudflare Account ID** (which after `https://dash.cloudflare.com/`) from ➞ https://dash.cloudflare.com/?to=/:account/workers
3. Create your **API Token** from ➞ https://dash.cloudflare.com/profile/api-tokens with 3 permissions 
   1. `Account.Zero Trust : Edit` 
   2. `Account.Account Firewall Access Rules : Edit`
   3. `Account.Access: Apps and Policies : Edit`

4. Add **Repository Secrets** to your forked repository
`➞ https://github.com/<username>/<forked-repository>/settings/secrets/actions`
   1. Set **Cloudflare Account ID** to `CF_IDENTIFIER`
   2. Set **API Token** to `CF_API_TOKEN`

* Enter folder

`cd <your forked name>`

* Edit `.env` (**required**)

```
nano .env
```
CF_API_TOKEN = "gd1_2IhOpoigbH2fVr8l6lmI4qvd4yIpAoxM0o4d"
CF_IDENTIFIER = "28a8fb99e937b1afbe7134d719e8253d"
```
`CTRL + X + Y + ENTER` to save it

* Command to upload (update) your DNS list.
```
python3 -m src
```
```

Note from [@minlaxz](https://github.com/minlaxz):
1. Domain list style: I personally preferred second one in blacklist styles, which has more readablity and concise.
2. Dynamic domain list: You can also update your dynamic (fluid) whitelist and blacklist using [dynamic_blacklist.txt](./lists/dynamic_blacklist.txt) and [dynamic_whitelist.txt](./lists/dynamic_whitelist.txt)
3. Deprected using `.env` : Setting sensitive information inside a public repository is considered too dangerous use-case, since any unwanted person could easily steal your Cloudflare credentials from that `.env` file.



 🥂🥂 Cheers! 🍻🍻
===
