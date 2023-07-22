require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const Discord = require("discord.js");
const WebSocket = require("ws");
const { WS_ADDR } = require("./config");
const {
  getUser,
  resolveAddress,
  getRepoDetails,
  setEmbedAuthor,
} = require("./util");

global.subscriptions = {};

const bot = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
  ],
});
let ws;

bot.commands = new Discord.Collection();
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      bot.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    bot.once(event.name, (...args) => event.execute(...args));
  } else {
    bot.on(event.name, (...args) => event.execute(...args));
  }
}

bot.login(process.env.DISCORD_BOT_TOKEN);

function connect() {
  // Connect to a WebSocket server
  ws = new WebSocket(WS_ADDR);

  ws.on("open", () => {
    console.log("Connected to WebSocket server");
    ws.send(
      JSON.stringify({
        method: "subscribe",
        params: { query: "tm.event='Tx'" },
        id: 1,
        jsonrpc: "2.0",
      })
    );
  });

  ws.on("message", async (message) => {
    // Parse the incoming message
    let data;
    try {
      data = JSON.parse(message).result.data;
    } catch (e) {
      console.error("Invalid JSON:", e);
      return;
    }

    if (!data || !data.value) {
      console.log("Ignoring message without value");
      return;
    }

    // Get the events from the transaction result
    const events = data.value.TxResult.result.events;

    // Iterate over the events
    for (let event of events) {
      // Decode the event type
      let eventType = Buffer.from(event.type).toString();

      // If the event type matches what we're interested in...
      if (eventType === "message") {
        let eventAttributes = {};

        // Iterate over the attributes of the event
        for (let attribute of event.attributes) {
          // Decode the attribute key and value
          let key = Buffer.from(attribute.key, "base64").toString();
          let value = Buffer.from(attribute.value, "base64").toString();

          eventAttributes[key] = value;
        }

        const embed = new Discord.EmbedBuilder();

        // Change the message format and displayed attributes based on the action value
        switch (eventAttributes["action"]) {
          case "MultiSetRepositoryBranch": {
            const user = await getUser(eventAttributes["Creator"]);

            let branches;
            try {
              branches = JSON.parse(eventAttributes["RepositoryBranch"]);
            } catch (e) {
              console.error("Invalid JSON:", e);
              return;
            }

            const repoOwnerName = await resolveAddress(
              eventAttributes["RepositoryOwnerId"],
              eventAttributes["RepositoryOwnerType"]
            );

            let names = "";
            let shas = "";
            for (let branch of branches) {
              names += `[${branch.name}](https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]}/tree/${branch.name})\n`;
              shas += `${branch.sha}\n`;
            }

            embed
              .setTitle("Repository branches updated")
              .setURL(
                `https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]}`
              )
              .setDescription(
                `[${repoOwnerName}/${eventAttributes["RepositoryName"]}](https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]})`
              )
              .addFields(
                { name: "Name", value: names, inline: true },
                { name: "Sha", value: shas, inline: true }
              )
              .setTimestamp();

            setEmbedAuthor(embed, user);

            break;
          }
          case "MultiDeleteRepositoryBranch": {
            const user = await getUser(eventAttributes["Creator"]);

            let branches;
            try {
              branches = JSON.parse(eventAttributes["RepositoryBranch"]);
            } catch (e) {
              console.error("Invalid JSON:", e);
              return;
            }

            let names = "";
            let shas = "";
            for (let branch of branches) {
              names += `${branch.name}\n`;
              shas += `${branch.sha}\n`;
            }

            const repoOwnerName = await resolveAddress(
              eventAttributes["RepositoryOwnerId"],
              eventAttributes["RepositoryOwnerType"]
            );

            embed
              .setTitle("Repository branches deleted")
              .setURL(
                `https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]}`
              )
              .setDescription(
                `[${repoOwnerName}/${eventAttributes["RepositoryName"]}](https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]})`
              )
              .addFields(
                { name: "Name", value: names, inline: true },
                { name: "Sha", value: shas, inline: true }
              )
              .setTimestamp();

            setEmbedAuthor(embed, user);

            break;
          }
          case "MultiSetRepositoryTag": {
            const user = await getUser(eventAttributes["Creator"]);

            let tags;
            try {
              tags = JSON.parse(eventAttributes["RepositoryTag"]);
            } catch (e) {
              console.error("Invalid JSON:", e);
              return;
            }

            const repoOwnerName = await resolveAddress(
              eventAttributes["RepositoryOwnerId"],
              eventAttributes["RepositoryOwnerType"]
            );

            let names = "";
            let shas = "";
            for (let tag of tags) {
              names += `[${tag.name}](https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]}/tree/${tag.name})\n`;
              shas += `${tag.sha}\n`;
            }

            embed
              .setTitle("Repository tags updated")
              .setURL(
                `https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]}`
              )
              .setDescription(
                `[${repoOwnerName}/${eventAttributes["RepositoryName"]}](https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]})`
              )
              .addFields(
                { name: "Name", value: names, inline: true },
                { name: "Sha", value: shas, inline: true }
              )
              .setTimestamp();

            setEmbedAuthor(embed, user);

            break;
          }
          case "MultiDeleteRepositoryTag": {
            const user = await getUser(eventAttributes["Creator"]);

            let tags;
            try {
              tags = JSON.parse(eventAttributes["RepositoryTag"]);
            } catch (e) {
              console.error("Invalid JSON:", e);
              return;
            }

            let names = "";
            let shas = "";
            for (let tag of tags) {
              names += `${tag.name}\n`;
              shas += `${tag.sha}\n`;
            }

            const repoOwnerName = await resolveAddress(
              eventAttributes["RepositoryOwnerId"],
              eventAttributes["RepositoryOwnerType"]
            );

            embed
              .setTitle("Repository tags deleted")
              .setURL(
                `https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]}`
              )
              .setDescription(
                `[${repoOwnerName}/${eventAttributes["RepositoryName"]}](https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]})`
              )
              .addFields(
                { name: "Name", value: names, inline: true },
                { name: "Sha", value: shas, inline: true }
              )
              .setTimestamp();

            setEmbedAuthor(embed, user);

            break;
          }
          case "CreateUser": {
            embed
              .setTitle("New user created")
              .setDescription(
                `[${eventAttributes["UserUsername"]}](https://gitopia.com/${eventAttributes["UserUsername"]})`
              )
              .setURL(`https://gitopia.com/${eventAttributes["UserUsername"]}`)
              .setTimestamp();

            if (eventAttributes["AvatarUrl"] !== "") {
              embed.setThumbnail(`${eventAttributes["AvatarUrl"]}`);
            }

            break;
          }
          case "CreateDao": {
            const user = await getUser(eventAttributes["Creator"]);

            embed
              .setTitle("New DAO created")
              .setURL(`https://gitopia.com/${eventAttributes["DaoName"]}`)
              .setDescription(
                `[${eventAttributes["DaoName"]}](https://gitopia.com/${eventAttributes["DaoName"]})`
              )
              .setTimestamp();

            if (eventAttributes["AvatarUrl"] !== "") {
              embed.setThumbnail(`${eventAttributes["AvatarUrl"]}`);
            }

            setEmbedAuthor(embed, user);

            break;
          }
          case "CreateRepository": {
            const user = await getUser(eventAttributes["Creator"]);

            const repoOwnerName = await resolveAddress(
              eventAttributes["RepositoryOwnerId"],
              eventAttributes["RepositoryOwnerType"]
            );

            embed
              .setTitle("New repository created")
              .setURL(
                `https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]}`
              )
              .setDescription(
                `[${eventAttributes["RepositoryName"]}](https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]})`
              )
              .setTimestamp();

            setEmbedAuthor(embed, user);

            break;
          }
          case "CreateIssue": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              embed
                .setTitle("New issue created")
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["IssueIid"]}`
                )
                .setDescription(
                  `[#${eventAttributes["IssueIid"]} ${eventAttributes["IssueTitle"]}](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["IssueIid"]})`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "AddIssueAssignees": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              let assignees = "";
              for (let assignee of JSON.parse(eventAttributes["Assignees"])) {
                const assigneeUser = await getUser(assignee);
                assignees += `[${assigneeUser.username}](https://gitopia.com/${assigneeUser.username}), `;
              }

              embed
                .setTitle(`Issue assigned`)
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["IssueIid"]}`
                )
                .setDescription(
                  `[${repoOwnerName}/${repositoryName} #${
                    eventAttributes["IssueIid"]
                  }](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${
                    eventAttributes["IssueIid"]
                  })\nAssignees: ${assignees.slice(0, -2)}`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "ToggleIssueState": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              switch (eventAttributes["IssueState"]) {
                case "OPEN":
                  embed.setTitle("Issue re-opened");
                  break;
                case "CLOSED":
                  embed.setTitle("Issue closed");
                  break;
                default:
                  console.log("invalid issue state");
              }

              embed
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["IssueIid"]}`
                )
                .setDescription(
                  `[${repoOwnerName}/${repositoryName} #${eventAttributes["IssueIid"]}](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["IssueIid"]})`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "CreatePullRequest": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              embed
                .setTitle("New PR created")
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/pulls/${eventAttributes["PullRequestIid"]}`
                )
                .setDescription(
                  `[#${eventAttributes["PullRequestIid"]} ${eventAttributes["PullRequestTitle"]}](https://gitopia.com/${repoOwnerName}/${repositoryName}/pulls/${eventAttributes["PullRequestIid"]})`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "AddPullRequestReviewers": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              let reviewers = "";
              for (let reviewer of JSON.parse(
                eventAttributes["PullRequestReviewers"]
              )) {
                const reviewer = await getUser(reviewer);
                reviewers += `<https://gitopia.com/${reviewer.username}|${reviewer.username}>, `;
              }

              embed
                .setTitle(`PR reviewers added`)
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/pulls/${eventAttributes["PullRequestIid"]}`
                )
                .setDescription(
                  `[${repoOwnerName}/${repositoryName} #${
                    eventAttributes["PullRequestIid"]
                  }](https://gitopia.com/${repoOwnerName}/${repositoryName}/pulls/${
                    eventAttributes["PullRequestIid"]
                  })\nReviewers: ${reviewers.slice(0, -2)}`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "SetPullRequestState": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              switch (eventAttributes["PullRequestState"]) {
                case "MERGED": {
                  const headRepo = JSON.parse(
                    eventAttributes["PullRequestHead"]
                  );

                  const {
                    repoOwnerName: headRepoOwnerName,
                    repositoryName: headRepositoryName,
                  } = await getRepoDetails(headRepo.repositoryId);
                  const baseRepoBranch = JSON.parse(
                    eventAttributes["RepositoryBranch"]
                  );

                  embed.setTitle("PR merged");
                  break;
                }
                case "CLOSED":
                  embed.setTitle("PR closed");
                  break;
                default:
                  console.log("invalid PR state");
              }

              embed
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]}/pulls/${eventAttributes["PullRequestIid"]}`
                )
                .setDescription(
                  `[${repoOwnerName}/${eventAttributes["RepositoryName"]} #${eventAttributes["PullRequestIid"]}](https://gitopia.com/${repoOwnerName}/${eventAttributes["RepositoryName"]}/pulls/${eventAttributes["PullRequestIid"]})`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "LinkPullRequestIssueByIid": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              embed
                .setTitle(`Issue linked to PR`)
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/pulls/${eventAttributes["PullRequestIid"]}`
                )
                .setDescription(
                  `[${repoOwnerName}/${repositoryName} #${eventAttributes["PullRequestIid"]}](https://gitopia.com/${repoOwnerName}/${repositoryName}/pulls/${eventAttributes["PullRequestIid"]})\nIssue: [#${eventAttributes["IssueIid"]}](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["IssueIid"]})`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "UnlinkPullRequestIssueByIid": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              embed
                .setTitle(`Issue unlinked from PR`)
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/pulls/${eventAttributes["PullRequestIid"]}`
                )
                .setDescription(
                  `[${repoOwnerName}/${repositoryName} #${eventAttributes["PullRequestIid"]}](https://gitopia.com/${repoOwnerName}/${repositoryName}/pulls/${eventAttributes["PullRequestIid"]})\nIssue: [#${eventAttributes["IssueIid"]}](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["IssueIid"]})`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          // case "/gitopia.gitopia.gitopia.MsgCreateComment": {
          //   embed
          //     .setTitle("New comment somewhere :man-shrugging:")
          //     .setTimestamp();

          //   break;
          // }
          case "ForkRepository": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["ParentRepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              const forkedRepoOwnerName = await resolveAddress(
                eventAttributes["RepositoryOwnerId"],
                eventAttributes["RepositoryOwnerType"]
              );

              embed
                .setTitle(`Repository forked`)
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}`
                )
                .setDescription(
                  `[${repoOwnerName}/${repositoryName}](https://gitopia.com/${repoOwnerName}/${repositoryName})\nFork repo: [${forkedRepoOwnerName}/${eventAttributes["RepositoryName"]}](https://gitopia.com/${forkedRepoOwnerName}/${eventAttributes["RepositoryName"]})`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "CreateBounty": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              let tokens = JSON.parse(eventAttributes["BountyAmount"]);

              let denoms,
                amounts = "";
              for (let token of tokens) {
                denoms += `${token.denom}\n`;
                amounts += `${token.amount}\n`;
              }

              embed
                .setTitle("New bounty added")
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["BountyParentIid"]}`
                )
                .setDescription(
                  `[${repoOwnerName}/${eventAttributes["RepositoryName"]} ${eventAttributes["BountyParentIid"]}](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["BountyParentIid"]})\n[Bounties](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["BountyParentIid"]}|#${eventAttributes["BountyParentIid"]}/bounties)`
                )
                .addFields(
                  { name: "Denom", value: denoms, inline: true },
                  { name: "Amount", value: amounts, inline: true }
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "UpdateBountyExpiry": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);
              const expiry = new Date(eventAttributes["BountyExpiry"] * 1000);

              embed
                .setTitle("Bounty expiry extended")
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["BountyParentIid"]}`
                )
                .setDescription(
                  `[${repoOwnerName}/${eventAttributes["RepositoryName"]} ${
                    eventAttributes["BountyParentIid"]
                  }](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${
                    eventAttributes["BountyParentIid"]
                  })\nNew expiry: ${expiry.toLocaleDateString()}\n[Bounties](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${
                    eventAttributes["BountyParentIid"]
                  }|#${eventAttributes["BountyParentIid"]}/bounties)`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          case "CloseBounty": {
            try {
              const { repoOwnerName, repositoryName } = await getRepoDetails(
                eventAttributes["RepositoryId"]
              );
              const user = await getUser(eventAttributes["Creator"]);

              embed
                .setTitle("Bounty closed")
                .setURL(
                  `https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["BountyParentIid"]}`
                )
                .setDescription(
                  `[${repoOwnerName}/${eventAttributes["RepositoryName"]} ${eventAttributes["BountyParentIid"]}](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["BountyParentIid"]})\n[Bounties](https://gitopia.com/${repoOwnerName}/${repositoryName}/issues/${eventAttributes["BountyParentIid"]}|#${eventAttributes["BountyParentIid"]}/bounties)`
                )
                .setTimestamp();

              setEmbedAuthor(embed, user);
            } catch (error) {
              console.error(`Error getting repository details: ${error}`);
            }
            break;
          }
          default:
            console.log(`Unsupported action ${eventAttributes["action"]}`);
        }

        const keysToCheck = ["RepositoryOwnerId", "RepositoryOwnerType"];
        const keysExist = keysToCheck.every((key) =>
          eventAttributes.hasOwnProperty(key)
        );

        let repoOwnerName = "";
        if (keysExist) {
          repoOwnerName = await resolveAddress(
            eventAttributes["RepositoryOwnerId"],
            eventAttributes["RepositoryOwnerType"]
          );
        }

        for (let s in global.subscriptions) {
          if (
            global.subscriptions[s].subscriptions.some(
              (item) =>
                item === "*" ||
                item.toLowerCase() === repoOwnerName.toLowerCase()
            ) &&
            embed.data.title
          ) {
            if (!global.subscriptions[s].channel) {
              global.subscriptions[s].channel = bot.channels.cache.get(s);
            }

            global.subscriptions[s].channel.send({ embeds: [embed] });
          }
        }
      }
    }
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error: ${error}`);
    ws.close();
  });

  ws.on("close", (code, reason) => {
    console.log(
      `WebSocket connection closed. Code: ${code}, Reason: ${reason}`
    );
    setTimeout(connect, 1000);
  });
}

connect();
