import React from 'react';
import { Link } from 'react-router-dom';
import { all_routes } from '../router/all_routes';
import ImageWithBasePath from '../../core/common/imageWithBasePath';

const Unauthorized: React.FC = () => {
  return (
    <div className="main-wrapper">
      <div className="error-box">
        <div className="error-img">
          <ImageWithBasePath src="assets/img/authentication/error-403.png" className="img-fluid" alt="403" />
        </div>
        <div className="error-content">
          <h2 className="error-title">Accès Non Autorisé</h2>
          <h4>Erreur 403 - Forbidden</h4>
          <p>
            Désolé, vous n'avez pas les permissions nécessaires pour accéder à cette page.
            Seuls les utilisateurs avec le rôle <strong>S2T</strong> peuvent accéder à la gestion des utilisateurs.
          </p>
          <div className="error-btn">
            <Link to={all_routes.adminDashboard} className="btn btn-primary">
              <i className="ti ti-arrow-left me-2"></i>
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;