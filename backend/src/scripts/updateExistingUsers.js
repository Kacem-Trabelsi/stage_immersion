/**
 * Script pour mettre à jour les utilisateurs existants avec les nouveaux champs
 */

const mongoose = require('mongoose');
const { User, UserRole } = require('../models/User');

// Configuration MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/synergypark';

async function updateExistingUsers() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connexion à MongoDB réussie');

    // Récupérer tous les utilisateurs
    const users = await User.find({});
    console.log(`📊 ${users.length} utilisateurs trouvés dans la base de données`);

    let updatedCount = 0;
    let s2tCount = 0;

    for (const user of users) {
      let needsUpdate = false;
      const updateData = {};

      // Ajouter le champ status s'il n'existe pas
      if (!user.status) {
        updateData.status = user.role === 'S2T' ? 'APPROVED' : 'PENDING';
        needsUpdate = true;
      }

      // Ajouter le champ blocked s'il n'existe pas
      if (user.blocked === undefined) {
        updateData.blocked = false;
        needsUpdate = true;
      }

      // Pour les utilisateurs S2T, s'assurer qu'ils sont approuvés
      if (user.role === 'S2T') {
        if (user.status !== 'APPROVED') {
          updateData.status = 'APPROVED';
          needsUpdate = true;
        }
        if (!user.approvedAt) {
          updateData.approvedAt = new Date();
          needsUpdate = true;
        }
        s2tCount++;
      }

      // Mettre à jour si nécessaire
      if (needsUpdate) {
        await User.findByIdAndUpdate(user._id, updateData);
        updatedCount++;
        console.log(`✅ Utilisateur mis à jour: ${user.email} (${user.role})`);
      }
    }

    console.log(`\n📈 Résumé de la mise à jour:`);
    console.log(`   - ${updatedCount} utilisateurs mis à jour`);
    console.log(`   - ${s2tCount} utilisateurs S2T trouvés`);
    
    if (s2tCount === 0) {
      console.log(`\n⚠️  ATTENTION: Aucun utilisateur S2T trouvé!`);
      console.log(`   Vous devez créer un utilisateur S2T pour gérer le système.`);
      console.log(`   Vous pouvez:`);
      console.log(`   1. Modifier manuellement un utilisateur existant en S2T`);
      console.log(`   2. Créer un nouvel utilisateur avec le rôle S2T`);
    } else {
      console.log(`\n✅ Système prêt! Utilisateurs S2T disponibles pour la gestion.`);
    }

    // Afficher tous les utilisateurs avec leurs nouveaux statuts
    console.log(`\n👥 Liste des utilisateurs:`);
    const updatedUsers = await User.find({}).select('email role status blocked createdAt');
    updatedUsers.forEach(user => {
      console.log(`   - ${user.email} | ${user.role} | ${user.status} | ${user.blocked ? 'BLOQUÉ' : 'ACTIF'}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📴 Connexion MongoDB fermée');
    process.exit(0);
  }
}

// Exécuter le script
updateExistingUsers();