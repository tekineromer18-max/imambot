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

    if (!presenceText) {
        console.log('⚠️ Durum metni tanımlanmamış!');
        return false;
    }

    if (config.surum === 'eski') {
        const result = presenceStatuses.some((status) => status.includes(presenceText));
        console.log(`   📝 "eski" modu: "${presenceText}" aranıyor, bulunamadı: ${!result}`);
        return result;
    }
    
    const result = presenceStatuses.includes(presenceText);
    console.log(`   📝 "yeni" modu: TAM eşleşme "${presenceText}", sonuç: ${result}`);
    return result;
}

async function addRoleToMember(member, config) {
    if (!member.roles) return;
    
    if (member.roles.cache.has(config.roleId)) {
        console.log(`   ℹ️ ${member.user.tag} zaten bu rolle sahip, skip.`);
        return;
    }

    try {
        console.log(`   ➕ ${member.user.tag} için rol veriliyor...`);
        await member.roles.add(config.roleId);
        await sendRoleChangeEmbed(member, config, true);
        console.log(`   ✅ ${member.user.tag} rolü verildi!`);
    } catch (error) {
        console.error(`   ❌ [Rol Hatası] ${member.user.tag} rolü verilirken hata: ${error.message}`);
    }
}

async function removeRoleFromMember(member, config) {
    if (!member.roles) return;
    
    if (!member.roles.cache.has(config.roleId)) {
        console.log(`   ℹ️ ${member.user.tag} bu rolle sahip değil, skip.`);
        return;
    }

    try {
        console.log(`   ➖ ${member.user.tag} için rol alınıyor...`);
        await member.roles.remove(config.roleId);
        await sendRoleChangeEmbed(member, config, false);
        console.log(`   ✅ ${member.user.tag} rolü alındı!`);
    } catch (error) {
        console.error(`   ❌ [Rol Hatası] ${member.user.tag} rolü alınırken hata: ${error.message}`);
    }
}

async function sendRoleChangeEmbed(member, config, given) {
    if (!config.logChannelId) return;

    const logChannel = member.guild.channels.cache.get(config.logChannelId);
    if (!logChannel) return;

    const role = member.guild.roles.cache.get(config.roleId);
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
 * presence parametresi isteğe bağlı, PresenceUpdate event'inden gelmişse verilir.
 */
async function evaluateMemberPresence(member, config, presence) {
    if (!member) return;

    // Eğer presence açıkça geçilmemişse, member cache'den al
    let presenceObj = presence || member.presence;
    
    if (!presenceObj) {
        console.log(`[⚠️] ${member.user.tag} için presence bilgisi bulunamadı, atlaniyor...`);
        return;
    }

    const status = presenceObj.status;
    if (!['online', 'idle', 'dnd'].includes(status)) {
        // Offline ise rolü kaldır
        await removeRoleFromMember(member, config);
        return;
    }

    const statuses = getCustomStatuses(presenceObj);
    console.log(`[👤] ${member.user.tag} özel durum: [${statuses.join(', ') || 'boş'}]`);

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
    try {
        // Tüm üyeleri ve presence'lerini al
        const members = await guild.members.fetch({ withPresences: true });

        let processedCount = 0;
        for (const member of members.values()) {
            await evaluateMemberPresence(member, config);
            processedCount++;
        }
        console.log(`[✅] ${processedCount} üye tarandı ve presence kontrol edildi.`);
    } catch (err) {
        console.error('[❌] Presence taraması hatası:', err?.message || err);
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
