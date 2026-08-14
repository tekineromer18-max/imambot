require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, ActivityType, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const roleManager = require('./lib/roleManager'); // Durum-Rol repo'dan (koruyun, değişiklik yok)
const tagManager = require('./lib/tagManager');   // Aşağıda verilen yeni dosya

// Ortak config: .env içinde tanımlanacak
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const tagConfig = {
  guildId: process.env.GUILD_ID,
  roleId: process.env.TAG_ROLE_ID || process.env.ROLE_ID,
  logChannelId: process.env.TAG_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
};

const presenceConfig = {
  guildId: process.env.GUILD_ID,
  roleId: process.env.PRESENCE_ROLE_ID || process.env.PRESENCE_ROL_ID,
  logChannelId: process.env.PRESENCE_LOG_CHANNEL_ID || process.env.PRESENCE_LOG_ID,
  durum: process.env.PRESENCE_DURUM || process.env.DURUM,
  surum: process.env.PRESENCE_SURUM || process.env.SURUM, // 'eski' veya 'yeni'
};

if (!TOKEN) {
  console.error('❌ .env içinde TOKEN (veya DISCORD_TOKEN) bulunamadı.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Map();

// load commands from ./commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const cmd = require(path.join(commandsPath, file));
    if (cmd && cmd.data && cmd.execute) {
      client.commands.set(cmd.data.name, cmd);
    }
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Giriş yapıldı: ${client.user.tag}`);

  // Aktivite
  try {
    client.user.setActivity({ name: 'Sunucu', type: ActivityType.Watching });
  } catch {}

  // Register guild commands if GUILD_ID sağlandı
  if (GUILD_ID) {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
      const commands = Array.from(client.commands.values()).map(c => c.data.toJSON());
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
      console.log('✅ Slash komutları yüklendi.');
    } catch (err) {
      console.error('Slash komut yükleme hatası:', err?.message || err);
    }
  } else {
    console.warn('GUILD_ID bulunamadı, slash komutları yüklenmedi (guild scope).');
  }

  // Bot açıldığında tüm üyelere presence göre kontrol
  try {
    if (presenceConfig && presenceConfig.roleId) {
      const guild = client.guilds.cache.get(presenceConfig.guildId || GUILD_ID);
      if (guild) {
        console.log('📊 Tüm üyeler taranıyor (presence kontrolü)...');
        await roleManager.checkAllMembersPresence(guild, presenceConfig);
        console.log('✅ Presence taraması tamamlandı.');
      }
    }
  } catch (err) {
    console.error('Başlangıç tarama hatası:', err?.message || err);
  }
});

// Tag change -> etiket rolünü kontrol et
client.on(Events.UserUpdate, async (oldUser, newUser) => {
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;
    const member = guild.members.cache.get(newUser.id);
    if (!member) return;
    await tagManager.checkAndAssignTagRole(member, client, tagConfig);
  } catch (err) {
    console.error('UserUpdate hatası:', err?.message || err);
  }
});

// Presence update -> durum rolünü kontrol et
client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
  try {
    const member = newPresence?.member;
    if (!member) return;
    // Member'ın presence'ini direkt newPresence'den al
    await roleManager.evaluateMemberPresence(member, presenceConfig, newPresence);
  } catch (err) {
    console.error('PresenceUpdate hatası:', err?.message || err);
  }
});

// Guild member add / update -> etiket rolünü kontrol et
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await tagManager.checkAndAssignTagRole(member, client, tagConfig);
  } catch (err) {
    console.error('GuildMemberAdd hatası:', err?.message || err);
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    await tagManager.checkAndAssignTagRole(newMember, client, tagConfig);
  } catch (err) {
    console.error('GuildMemberUpdate hatası:', err?.message || err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    await command.execute(interaction, client, tagConfig); // istatistik komutu tagConfig bekliyor
  } catch (err) {
    console.error('InteractionCreate hatası:', err?.message || err);
    if (interaction) {
      const reply = { content: 'Komut çalıştırılırken bir hata oluştu!', ephemeral: true };
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
        else await interaction.reply(reply);
      } catch {}
    }
  }
});

client.on('error', (err) => console.error('[Client Hatası]', err?.message || err));
process.on('unhandledRejection', (err) => console.error('[UnhandledRejection]', err));

client.login(TOKEN).catch((err) => {
  console.error('Giriş hatası:', err?.message || err);
  process.exit(1);
});
