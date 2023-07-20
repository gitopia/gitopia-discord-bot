const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unsubscribe")
    .setDescription("Unsubscribe to User/DAO events")
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
    const index = global.subscriptions[channelId].subscriptions.indexOf(user);
    if (index !== -1) {
      global.subscriptions[channelId].subscriptions.splice(index, 1);
      message = `Unsubscribed to ${user}`;
    } else {
      message = `Not subscribing to ${user} already`;
    }

    await interaction.reply({
      content: message,
      ephemeral: true,
    });
  },
};
