import { Message, Client, Attachment } from 'discord.js';
import * as fs from 'fs';
import * as conf from './bot-config.json';
import exitHook = require('exit-hook');

// console logging info
require('console-stamp')(console, {
    metadata: function () {
        let orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        let err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        let stack: any = err.stack;
        Error.prepareStackTrace = orig;

        let output = `[${stack[1].getFileName().split(/[\\\/]/).pop()}:${stack[1].getFunctionName()}:${stack[1].getLineNumber()}]   `;
        for (; output.length < 25; output += ' ') { }
        return output;
    },
    pattern: 'dd/mm/yyyy HH:MM:ss.l'
});

process.on('uncaughtException', (error) => {
    console.error(error);
});

process.on('unhandledRejection', async (reason, promise) => {
    let error = new Error('Unhandled Rejection. Reason: ' + reason);
    console.error(error, "Promise:", promise);
});

exitHook(() => {
    console.log('Saving story...');
    save();
    console.log("Story saved");
});

// all commands
let commands = {
    'savestory': async (message: Message, args: string) => {
        if (!conf.botMasters.includes(message.author.id)) return; // when the command only should be used by mods
        save();
        message.channel.send('Story was saved successfully');
    },
    'showstory': async (message: Message, args: string) => {
        if (Object.entries(words).length === 0)
            return message.channel.send('*empty story*');

        let story = Object.values(words);
        if (!args.toLocaleLowerCase().includes('file'))
            return message.channel.send(story.slice(-maxWordsPerMessage).join(' '));

        try {
            let name = `story ${new Date().toDateString()}.txt`;
            let content = Buffer.from(story.join(' '), 'utf8');;
            let attachment = new Attachment(content, name);
            await message.channel.send(`Story is ${story.length} words long`, attachment);
        } catch (err) {
            console.debug(err);
            message.channel.send('file to large to send');
        }
    }
};

let words = {};
if (fs.existsSync(conf.saveLocation)) words = fs.readFileSync(conf.saveLocation).toString().split(' ');

let maxWordsPerMessage = Math.floor(2000 / (conf.limits.maxWordLength + 1));
console.info(`${conf.prefix}showstory will return ${maxWordsPerMessage} words at max`);

function checkMessage(message: Message) {
    if (message.content.length > conf.limits.maxWordLength) return false;
    if (/[\s_]/gm.test(message.content)) return false;
    if (/[A-Z].*[A-Z]/gm.test(message.content) &&
        message.content !== message.content.toUpperCase()) return false;
    if (conf.limits.bannedWords.includes(message.content.toLowerCase())) return false;
    if (conf.limits.bannedUsers.includes(message.author.id)) return false;
    return true;
}

function save() {
    let content = Object.values(words).join(' ');
    fs.writeFileSync(conf.saveLocation, content);
}

let client = new Client({ disableEveryone: true });
client.on('ready', () => {
    setInterval(save, conf.saveInterval);
    console.info(`Saving story every ${conf.saveInterval} milliseconds`);
    console.info("I'm ready!");
});

client.on('message', async message => {
    if (message.author.bot) return; // bot shouldn't listen to other bots
    if (message.content.startsWith(conf.prefix)) {
        let command = message.content.split(' ')[0].slice(conf.prefix.length).toLowerCase(); // gets command name
        let args = message.content.slice(conf.prefix.length + command.length + 1);
        let cmdFunc = commands[command];
        if (cmdFunc) cmdFunc(message, args);
        return;
    }

    if (message.channel.id != conf.channel) return;
    if (checkMessage(message))
        words[message.id] = message.content;
    else {
        console.log(message.author.username, message.author.id, message.content);
        message.delete(0);
    }

});

client.on('messageUpdate', (oldMessage, newMessage) => {
    if (newMessage.channel.id != conf.channel) return;
    if (!checkMessage(newMessage)) return;
    words[newMessage.id] = newMessage.content;

})

client.on('messageDelete', message => {
    if (message.channel.id != conf.channel) return;
    delete words[message.id];
});

client.login(conf.botToken);