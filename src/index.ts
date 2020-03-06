import { Message, Client, Attachment, TextChannel, Channel } from 'discord.js';
import * as fs from 'fs';
import * as conf from './bot-config.json';
import exitHook = require('exit-hook');
import { isUndefined } from 'util';

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

// interface to properly type messages.
interface story {
    lastMessageId: string,
    story: {
        [id: string]: string
    }
}
interface indexReturn {
    messages: Array<indexObject>,
    lastId: string
}
interface indexObject {
    message: string,
    id: string
}

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
    'wholestory': async (message: Message, args: string) => { // command to index an entire channel
        if (message.channel.type!="text") return;
        let lArgs= args.split(" ");
        let indexed: Promise<indexReturn>;
        let channel: any = message.channel;
        try{
            switch(lArgs.length){
                case 1:
                    indexed=indexChannel(channel,message.id,Number(lArgs[0]));
                    break;
                case 2:
                    indexed=indexChannel(channel,message.id,Number(lArgs[0]),lArgs[1].toLowerCase()=="true");
                    break;
                case 3:
                    indexed=indexChannel(channel,message.id,Number(lArgs[0]),lArgs[1].toLowerCase()=="true",Number(lArgs[2]));
                    break;
                default:
                    indexed=indexChannel(channel,message.id);
                    break;
            }
            indexed.then(e=>{
                let newMessage=convertToStory(e);
                words.lastMessageId=newMessage.lastMessageId;
                Object.assign(words.story, newMessage.story);
                save();
            })
        } catch(e) {
            console.log(e);
        }
        let story = Object.values(words.story);
        let embed = {
            "embed": {
                "description": `The story length is: ${story.length} Words`,
                "timestamp": new Date().toISOString(),
                "color": conf.embedColor,
                "author": {
                    "name": "One Word Story",
                    "url": `https://discordapp.com/channels/${conf.guild}/${conf.channel}`
                }
            }
        };
        message.author.send(embed);
        message.delete();
    },
    'savestory': async (message: Message, args: string) => {
        if (!conf.botMasters.includes(message.author.id)) return; // when the command only should be used by mods
        save();
        message.channel.send('Story was saved successfully');
    },
    'showstory': async (message: Message, args: string) => {
        let story = Object.values(words.story);
        if (!args.toLocaleLowerCase().includes('file')) {
            let embed = {
                "embed": {
                    "description": story.slice(-maxWordsPerMessage).join(' '),
                    "timestamp": new Date().toISOString(),
                    "color": conf.embedColor,
                    "footer": {
                        "text": `${story.length} Words`
                    },
                    "author": {
                        "name": "One Word Story",
                        "url": `https://discordapp.com/channels/${conf.guild}/${conf.channel}`
                    }
                }
            };
            message.channel.send(embed);
            return;
        }

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

let words: story={lastMessageId:"",story:{}};
if (fs.existsSync(conf.saveLocation)) words = JSON.parse(fs.readFileSync(conf.saveLocation).toString());

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

/** 
Recursive function, only channel and start (message id) is strictly required. 
If topToBot is set to true will read from start variable and then down.
NOTE: limit can not be set to more than 100.
*/
async function indexChannel(channel:TextChannel ,start: string, limit=100, topToBot=false, maxiteration=Infinity, length=0, message:Array<indexObject>=[], iterate=0): Promise<indexReturn>{
    let controll={limit:limit};
    let conString="after";
    if (topToBot) conString="before";
    controll[conString]=start;
    let mess = await channel.fetchMessages(controll)
    let conCatMess=message.concat(mess.array().map(e=>{return {message:e.content,id:e.id};}));
    if (length+limit>length+mess.size || iterate==maxiteration) { 
            return {messages:conCatMess,lastId:mess.array()[mess.array().length-1].id};
    } else {
        iterate++
        //console.log(iterate,maxiteration,start)
        return indexChannel(channel,mess.array()[mess.array().length-1].id,limit,topToBot,maxiteration,length+mess.size,conCatMess,iterate)
    }
}
/** Return all data generated from indexChannel converted into StoryObject. */
function convertToStory(object:indexReturn){
    let storyObject:story={lastMessageId:"",story:{}};
    storyObject.lastMessageId = object.lastId;
    object.messages.forEach(e=>{storyObject.story[e.id]=e.message});
    return storyObject;
}

/** Check if reading from last id is necissary, and then do so. */
function checkLastId(channel:TextChannel){
    if(words.lastMessageId=="") return;
    if(channel.lastMessageID==words.lastMessageId) return;
    if(channel.messages[words.lastMessageId]==undefined) {
        words.lastMessageId=channel.lastMessageID;
        return;
    }
    indexChannel(channel,words.lastMessageId,100,true).then(e=>{
        let newMessage=convertToStory(e)
        words.lastMessageId=newMessage.lastMessageId;
        Object.assign(words.story, newMessage.story);
        save();
    });
}
  
function save() {
    if(words.lastMessageId=="") return;
    fs.writeFileSync(conf.saveLocation, JSON.stringify(words));
}

let client = new Client({ disableEveryone: true });
client.on('ready', () => {
    let channel: any = client.channels.get(conf.channel);
    checkLastId(channel)
    setInterval(save, conf.saveInterval);
    console.info(`Saving story every ${conf.saveInterval} milliseconds`);
    console.info("I'm ready!");
});

client.on('message', async message => {
    if (message.author.bot) return; // bot shouldn't listen to other bots
    if (message.guild.id !== conf.guild) return;
    if (message.content.startsWith(conf.prefix)) {
        let command = message.content.split(' ')[0].slice(conf.prefix.length).toLowerCase(); // gets command name
        let args = message.content.slice(conf.prefix.length + command.length + 1);
        let cmdFunc = commands[command];
        if (cmdFunc) cmdFunc(message, args);
        return;
    }

    if (message.channel.id != conf.channel) return;
    if (checkMessage(message)) {
        words.story[message.id] = message.content;
        words.lastMessageId = message.id;
    } else {
        console.log(message.author.username, message.author.id, message.content);
        message.delete(0);
    }

});

client.on('messageUpdate', (oldMessage, newMessage) => {
    if (newMessage.channel.id != conf.channel) return;
    if (!checkMessage(newMessage)) return;
    words.story[newMessage.id] = newMessage.content;

})

client.on('messageDelete', message => {
    if (message.channel.id != conf.channel) return;
    delete words.story[message.id];
});

client.login(conf.botToken);