# fb-meme-chat-bot
There are so many other useful things that could have been made instead.

### Uses:

 - `facebook-chat-api` NPM package to communicate with FB Messenger
 - MongoDB
 - Google Photos for permanent and limitless meme storage
 - Babel for modern ES features
 - ESLint to keep sane
 - Yarn

### Commands:   

- `yarn build` - Lint & transpile files into from `src/` to `dist/`
- `yarn start` - Builds from `src/` and runs `dist/index.js`

###  Arguments:
- `email` - Required, Facebook account email
- `password` - Required, Facebook account password
- `install` - First time setup
- `verbose` - Verbose mode
- `errorQuit` - Quit when error encountered?

e.g first time setup:
`yarn start --email example@example.com --password hunter2 --install`
and from then on
`yarn start --email example@example.com --password hunter2`

I recommend using an alternate account as the email and password is required every
time to let the bot run, I also haven't checked the `facebook-chat-api`
package for any security holes/password leak attempts.

### `./config.js`

Database and feature configuration go here.

### Deployment

Will try to package this up in a lovely way at some point.
