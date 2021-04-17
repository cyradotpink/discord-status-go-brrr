# Make your Discord status go brrr today!

It's fun, it's easy, it violates Discord's terms of service, and it's free.

## Usage

Install with npm:
```
npm install --global https://github.com/SimonAlexPaul/discord-status-go-brrr
```
Create a config file somewhere that looks like this:
```json
{
    "authorization":"<Your Discord authorization token>",
    "timedTextDir":"<Directory containing the caption files>",
    "dryRun":true
}
```
`timedTextDir` should be an absolute path, or a path relative to the location of the config file.\
`dryRun` is optional, and is false by default.\
\
Assuming that you named your config file `config.json`, you may start the script like this:
```
discord-status-go-brrr config.json
```
The location of the config file will be remembered, but can be changed at any time by starting the program with a new config location specified.\
The configuration itself is not remembered, only the location of the config file.\
Currently, only the YouTube timedtext json format is supported.