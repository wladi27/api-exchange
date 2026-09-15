const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_FILE = process.env.API_KEYS_FILE || path.join(__dirname, '..', 'api-keys.json');

function loadKeys() {
  try {
    const data = fs.readFileSync(KEYS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading keys file:', error.message);
    process.exit(1);
  }
}

function saveKeys(data) {
  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving keys file:', error.message);
    process.exit(1);
  }
}

function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

function generateKeyEntry(name) {
  const key = generateKey();
  return {
    key,
    name: name || 'Default',
    created_at: new Date().toISOString(),
    last_used: null,
    active: true
  };
}

function listKeys() {
  const data = loadKeys();
  console.log('\n📋 API Keys\n');
  console.log('='.repeat(80));
  
  if (data.keys.length === 0) {
    console.log('No API keys found. Generate one with: node scripts/manage-keys.js generate --name "My App"');
    return;
  }

  data.keys.forEach((keyEntry, index) => {
    const status = keyEntry.active ? '✅ Active' : '❌ Revoked';
    const lastUsed = keyEntry.last_used ? new Date(keyEntry.last_used).toLocaleString() : 'Never';
    console.log(`\n${index + 1}. ${keyEntry.name}`);
    console.log(`   Key: ${keyEntry.key.substring(0, 8)}...${keyEntry.key.substring(keyEntry.key.length - 8)}`);
    console.log(`   Created: ${new Date(keyEntry.created_at).toLocaleString()}`);
    console.log(`   Last Used: ${lastUsed}`);
    console.log(`   Status: ${status}`);
  });
  console.log('\n' + '='.repeat(80));
}

function generateKeyCommand(name) {
  const data = loadKeys();
  const newKey = generateKeyEntry(name);
  data.keys.push(newKey);
  saveKeys(data);
  
  console.log('\n✅ API Key generated successfully!\n');
  console.log('='.repeat(80));
  console.log(`Name: ${newKey.name}`);
  console.log(`Key: ${newKey.key}`);
  console.log(`Created: ${new Date(newKey.created_at).toLocaleString()}`);
  console.log('='.repeat(80));
  console.log('\n⚠️  Save this key securely. It will not be shown again.');
  console.log('Use it in requests with the header: X-Api-Key: ' + newKey.key + '\n');
}

function revokeKey(keyToRevoke) {
  const data = loadKeys();
  const keyIndex = data.keys.findIndex(k => k.key === keyToRevoke);
  
  if (keyIndex === -1) {
    console.error('❌ Key not found');
    process.exit(1);
  }
  
  data.keys[keyIndex].active = false;
  saveKeys(data);
  console.log('✅ Key revoked successfully');
}

function showHelp() {
  console.log('\n🔑 API Key Manager\n');
  console.log('Usage: node scripts/manage-keys.js <command> [options]\n');
  console.log('Commands:');
  console.log('  generate [--name <name>]    Generate a new API key');
  console.log('  list                        List all API keys');
  console.log('  revoke <key>                Revoke an API key');
  console.log('  help                        Show this help message\n');
  console.log('Examples:');
  console.log('  node scripts/manage-keys.js generate --name "My Production App"');
  console.log('  node scripts/manage-keys.js list');
  console.log('  node scripts/manage-keys.js revoke abc123...xyz789\n');
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  showHelp();
  process.exit(0);
}

switch (command) {
  case 'generate':
    const nameIndex = args.indexOf('--name');
    const name = nameIndex !== -1 ? args[nameIndex + 1] : 'Default';
    generateKeyCommand(name);
    break;
  case 'list':
    listKeys();
    break;
  case 'revoke':
    if (!args[1]) {
      console.error('❌ Error: Please provide the key to revoke');
      process.exit(1);
    }
    revokeKey(args[1]);
    break;
  default:
    console.error('❌ Unknown command:', command);
    showHelp();
    process.exit(1);
}
