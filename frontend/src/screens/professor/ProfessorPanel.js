import React from 'react';
import ProfessorLayout from './ProfessorLayout';

function ProfessorPanel({ onBack, onApplySimulation, ageDays, setAgeDays }) {
  return <ProfessorLayout onBack={onBack} onApplySimulation={onApplySimulation} ageDays={ageDays} setAgeDays={setAgeDays} />;
}

export default ProfessorPanel;
