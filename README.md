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
    "guild": "[guild id]",
    "channel": "[channel id]",
    "limits": {
        "maxWordLength": 15,
        "bannedWords": [
            "corn"
        ],
        "bannedUsers": [
            "user id"
        ]
    },
    "embedColor": 8311585,
    "saveLocation": "story.txt",
    "saveInterval": 10000
}
```

* `limits.maxWordLength` is in characters
* `embedColor` is a color code as specified in the Discord docs
* `saveInterval` is in milliseconds
