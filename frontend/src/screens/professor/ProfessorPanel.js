import React from 'react';
import ProfessorLayout from './ProfessorLayout';

function ProfessorPanel({ onBack, onApplySimulation }) {
  return <ProfessorLayout onBack={onBack} onApplySimulation={onApplySimulation} />;
}

export default ProfessorPanel;
