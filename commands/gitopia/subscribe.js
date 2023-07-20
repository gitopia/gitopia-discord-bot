const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("subscribe")
    .setDescription("Subscribe to User/DAO events")
    .addStringOption((option) =>
      option
        .setName("user")
        .setDescription("The username or DAO name")
        .setRequired(true)
    ),
  async execute(interaction) {
    const user = interaction.options.getString("user");

    const channelId = interaction.channel.id;

    if (!global.subscriptions[channelId]) {
      global.subscriptions[channelId] = { channel: null, subscriptions: [] };
    }

    let message;
    if (user === "list") {
      message = `Active subscriptions: ${global.subscriptions[channelId].subscriptions}`;
    } else {
      const index = global.subscriptions[channelId].subscriptions.indexOf(user);
      if (index !== -1) {
        message = `Already subscribed to ${user}`;
      } else {
        global.subscriptions[channelId].subscriptions.push(user);
        message = `Subscribed to ${user}`;
      }
    }

    await interaction.reply({
      content: message,
      ephemeral: true,
    });
  },
};
