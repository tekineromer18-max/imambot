const { EmbedBuilder, ActivityType } = require('discord.js');

/**
 * Bir üyenin özel durum (custom status) metinlerini döndürür.
 */
function getCustomStatuses(presence) {
    if (!presence || !presence.activities) return [];
    return presence.activities
        .filter((activity) => activity.type === ActivityType.Custom)
        .map((activity) => (activity.state ? activity.state.trim() : ''));
}

/**
 * config.surum ayarına göre durum eşleşmesini kontrol eder.
 * "eski"  -> durum metni, kullanıcının özel durumu İÇİNDE geçiyorsa eşleşir.
 * "yeni"  -> durum metni, kullanıcının özel durumuyla TAM olarak eşleşmelidir.
 */
function isPresenceMatch(config, presenceStatuses) {
    const presenceText = config.durum ? config.durum.trim() : '';

    if (config.surum === 'eski') {
        return presenceStatuses.some((status) => status.includes(presenceText));
    }
    return presenceStatuses.includes(presenceText);
}

async function addRoleToMember(member, config) {
    if (member.roles.cache.has(config.rolid)) return;

    try {
        await member.roles.add(config.rolid);
        await sendRoleChangeEmbed(member, config, true);
    } catch (error) {
        console.error(`[Rol Hatası] ${member.user.tag} rolü verilirken hata oluştu: ${error.message}`);
    }
}

async function removeRoleFromMember(member, config) {
    if (!member.roles.cache.has(config.rolid)) return;

    try {
        await member.roles.remove(config.rolid);
        await sendRoleChangeEmbed(member, config, false);
    } catch (error) {
        console.error(`[Rol Hatası] ${member.user.tag} rolü alınırken hata oluştu: ${error.message}`);
    }
}

async function sendRoleChangeEmbed(member, config, given) {
    if (!config.logid) return;

    const logChannel = member.guild.channels.cache.get(config.logid);
    if (!logChannel) return;

    const role = member.guild.roles.cache.get(config.rolid);
    const roleName = role ? role.name : 'Rol Bulunamadı';

    const embed = new EmbedBuilder()
        .setColor(given ? '#00FF00' : '#FF0000')
        .setTitle(given ? 'Rol Verildi!' : 'Rol Alındı!')
        .setDescription(given ? `Hoş geldin, ${member.user.username}!` : `Üzgünüz, ${member.user.username}.`)
        .addFields(
            { name: 'Üye', value: `${member.user.tag}`, inline: true },
            { name: 'Rol', value: roleName, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL({ extension: 'png' }))
        .setFooter({ text: `Tarih: ${new Date().toLocaleString('tr-TR')}` })
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch((error) => {
        console.error(`[Log Hatası] Log mesajı gönderilemedi: ${error.message}`);
    });
}

/**
 * Tek bir üyenin mevcut durumuna göre rolünü günceller.
 */
async function evaluateMemberPresence(member, config) {
    if (!member || !member.presence) return;

    const status = member.presence.status;
    if (!['online', 'idle', 'dnd'].includes(status)) return;

    const statuses = getCustomStatuses(member.presence);

    if (isPresenceMatch(config, statuses)) {
        await addRoleToMember(member, config);
    } else {
        await removeRoleFromMember(member, config);
    }
}

/**
 * Sunucudaki tüm üyeleri tarayıp durumlarına göre rollerini günceller.
 * Bot yeniden başladığında (ready event) kullanılır.
 */
async function checkAllMembersPresence(guild, config) {
    const members = await guild.members.fetch();

    for (const member of members.values()) {
        await evaluateMemberPresence(member, config);
    }
}

module.exports = {
    getCustomStatuses,
    isPresenceMatch,
    addRoleToMember,
    removeRoleFromMember,
    sendRoleChangeEmbed,
    evaluateMemberPresence,
    checkAllMembersPresence,
};
