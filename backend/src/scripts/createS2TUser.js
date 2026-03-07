/**
 * Script pour créer un utilisateur S2T administrateur
 */

const mongoose = require('mongoose');
const { User, UserRole } = require('../models/User');

// Configuration MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/synergypark';

async function createS2TUser() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connexion à MongoDB réussie');

    // Vérifier si un utilisateur S2T existe déjà
    const existingS2T = await User.findOne({ role: 'S2T' });
    
    if (existingS2T) {
      console.log('ℹ️  Un utilisateur S2T existe déjà:', existingS2T.email);
      return;
    }

    // Créer l'utilisateur S2T
    const s2tUser = new User({
      username: 'admin_s2t',
      email: 'admin@s2t.com',
      password: 'admin123', // Sera hashé automatiquement
      firstName: 'Admin',
      lastName: 'S2T',
      role: UserRole.S2T,
      status: 'APPROVED',
      approvedAt: new Date(),
      isActive: true
    });

    await s2tUser.save();
    
    console.log('✅ Utilisateur S2T créé avec succès!');
    console.log('📧 Email:', s2tUser.email);
    console.log('🔑 Mot de passe: admin123');
    console.log('👤 Username:', s2tUser.username);
    console.log('🆔 ID:', s2tUser._id);

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur S2T:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📴 Connexion MongoDB fermée');
    process.exit(0);
  }
}

// Exécuter le script
createS2TUser();