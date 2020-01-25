# OneWordBot

A simple Discord bot which auto moderates One Word Stories and compiles the story together.

## Bot Configuration File

To be placed in `src/bot-config.json` or `out/bot-config.json` if only compiled source is available.

```JSON
{
    "prefix": "?!",
    "botToken": "[bot token]",
    "botMasters": [
        "[user id]"
    ],
    "channel": "[channel id]",
    "limits": {
        "maxWordLength": 15, # in chars
        "bannedWords": [
            "corn"
        ],
        "bannedUsers": [
            "user id"
        ]
    },
    "saveLocation": "story.txt",
    "saveInterval": 10000 # in milliseconds
}
```

* `limits.maxWordLength` is in characters
* `saveInterval` is in milliseconds
