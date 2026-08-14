const { EmbedBuilder } = require('discord.js');

function getClanBadgeUrl(guildId, badgeHash) {
  if (!badgeHash) return null;
  return `https://cdn.discordapp.com/clan-badges/${guildId}/${badgeHash}.png?size=4096`;
}

async function sendTagAddedLog(member, primaryGuild, tagConfig) {
  if (!tagConfig.logChannelId) return;
  const logChannel = member.guild.channels.cache.get(tagConfig.logChannelId);
  if (!logChannel) return;

  const badgeUrl = getClanBadgeUrl(primaryGuild?.identity_guild_id, primaryGuild?.badge);

  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setAuthor({ name: 'Desteğin için teşekkürler!', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
    .setTitle('❤️ Etiket Destekçisi')
    .setDescription(`> Sunucumuzun etiketini alarak bizi temsil ettiğin için teşekkür ederiz, <@${member.id}>. Etiketi taşıdığın sürece bu rol sende kalacak.`)
    .setThumbnail(badgeUrl)
    .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL?.({ dynamic: true }) })
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

async function sendTagRemovedLog(member, guildIcon, tagConfig) {
  if (!tagConfig.logChannelId) return;
  const logChannel = member.guild.channels.cache.get(tagConfig.logChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor('#E74C3C')
    .setAuthor({ name: 'Şu ana kadar verdiğin destek için teşekkürler.', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
    .setTitle('❤️ Tekrar görüşmek dileğiyle!')
    .setDescription(`> Şu ana kadar verdiğin destek için teşekkürler, <@${member.id}>. Etiketi tekrar alarak rolünü geri alabileceğini unutma!`)
    .setThumbnail(guildIcon)
    .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL?.({ dynamic: true }) })
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

/**
 * member: GuildMember
 * client: discord.js client (kullanmak için client.rest.get)
 * tagConfig: { guildId, roleId, logChannelId }
 */
async function checkAndAssignTagRole(member, client, tagConfig) {
  if (!member || !member.guild) return;
  if (tagConfig.guildId && member.guild.id !== String(tagConfig.guildId)) return;

  // user data from REST (may rate-limit)
  let userData = null;
  try {
    userData = await client.rest.get(`/users/${member.id}`).catch(() => null);
  } catch {
    userData = null;
  }
  if (!userData) return;

  const role = member.guild.roles.cache.get(tagConfig.roleId);
  if (!role) {
    console.error('Tag role bulunamadı! ROLE ID kontrol edin.');
    return;
  }

  const hasCorrectTag = userData?.primary_guild && String(userData.primary_guild.identity_guild_id) === String(tagConfig.guildId);
  const hasRole = member.roles.cache.has(tagConfig.roleId);

  if (hasCorrectTag && !hasRole) {
    try {
      await member.roles.add(role);
      await sendTagAddedLog(member, userData.primary_guild, tagConfig);
      console.log(`[+] ${member.user.tag} kullanıcısına etiket rolü verildi.`);
    } catch (err) {
      console.error('Rol verme hatası:', err?.message || err);
    }
  } else if (!hasCorrectTag && hasRole) {
    try {
      await member.roles.remove(role);
      await sendTagRemovedLog(member, member.guild.iconURL?.({ dynamic: true }), tagConfig);
      console.log(`[-] ${member.user.tag} kullanıcısından etiket rolü alındı.`);
    } catch (err) {
      console.error('Rol alma hatası:', err?.message || err);
    }
  }
}

module.exports = {
  checkAndAssignTagRole,
  sendTagAddedLog,
  sendTagRemovedLog,
};
