import React, { useState, useEffect } from 'react';
import { configuracoes as configuracoesApi } from '../../api';
import { DEFAULT_WEIGHTS } from '../../engine/mascotEngine';
import { styles } from './shared';

function PesosSection({ turmaAtualId }) {
  const [weights, setWeights] = useState({
    score:         DEFAULT_WEIGHTS.score * 100,
    survival:      DEFAULT_WEIGHTS.survival * 100,
    challenges:    DEFAULT_WEIGHTS.challenges * 100,
    response_time: DEFAULT_WEIGHTS.response_time * 100,
  });

  useEffect(() => {
    if (!turmaAtualId) return;
    configuracoesApi.getPesos(turmaAtualId)
      .then(data => setWeights(data))
      .catch(() => {});
  }, [turmaAtualId]);

  return (
    <>
      <div style={styles.sectionTitle}>pesos da nota automática</div>
      <div style={styles.weights}>
        {[
          {key:'score', label:'Pontuação'},
          {key:'survival', label:'Sobrevivência'},
          {key:'challenges', label:'Desafios'},
          {key:'response_time', label:'Tempo de resposta'},
        ].map(w=>(
          <div key={w.key} style={styles.weightRow}>
            <div style={styles.weightLabel}>{w.label}</div>
            <input type="range" min="0" max="100" step="5" value={weights[w.key]}
              onChange={e => {
                const newWeights = { ...weights, [w.key]: Number(e.target.value) };
                setWeights(newWeights);
                configuracoesApi.setPesos(newWeights, turmaAtualId).catch(() => {});
              }}
              style={styles.weightSlider}/>
            <div style={styles.weightVal}>{weights[w.key]}%</div>
          </div>
        ))}
      </div>
      <div style={{height:'1rem'}}/>
    </>
  );
}

export default PesosSection;
