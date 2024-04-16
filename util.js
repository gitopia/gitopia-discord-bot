const axios = require("axios");

async function getUser(address) {
  const response = await axios.get(
    `${process.env.GITOPIA_API_URL}/user/${address}`
  );

  // Ensure the response data contains a username
  if (response.data && response.data.User.username) {
    if (response.data.User.username !== "") {
      return response.data.User;
    }
  }

  return { username: address, avatarUrl: "" };
}

async function getDAO(address) {
  const response = await axios.get(
    `${process.env.GITOPIA_API_URL}/dao/${address}`
  );

  // Ensure the response data contains a name
  if (response.data && response.data.dao.name) {
    return response.data.dao;
  } else {
    throw new Error("Unable to retrieve DAO name");
  }
}

const resolveAddress = async (address, type) => {
  if (type === "USER") {
    const user = await getUser(address);
    return user.username;
  }

  const dao = await getDAO(address);
  return dao.name;
};

const getRepoDetails = async (repositoryId) => {
  const response = await axios.get(
    `${process.env.GITOPIA_API_URL}/repository/${repositoryId}`
  );

  const repositoryOwnerId = response.data.Repository.owner.id;
  const repositoryOwnerType = response.data.Repository.owner.type;
  const repositoryName = response.data.Repository.name;

  const repoOwnerName = await resolveAddress(
    repositoryOwnerId,
    repositoryOwnerType
  );

  return { repoOwnerName, repositoryName };
};

const setEmbedAuthor = (embed, user) => {
  if (user.avatarUrl !== "") {
    embed.setAuthor({
      name: `${user.username}`,
      url: `https://gitopia.com/${user.username}`,
      iconURL: `${user.avatarUrl}`,
    });
  } else {
    embed.setAuthor({
      name: `${user.username}`,
      url: `https://gitopia.com/${user.username}`,
    });
  }
};

module.exports = {
  getUser,
  getDAO,
  resolveAddress,
  getRepoDetails,
  setEmbedAuthor,
};
