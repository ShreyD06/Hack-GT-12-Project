export class FootballAnomalyDetector {
  constructor(windowSize = 6, sensitivity = 2.0, minChangeMagnitude = 0.3) {
    this.windowSize = windowSize;
    this.sensitivity = sensitivity;
    this.minChangeMagnitude = minChangeMagnitude;
  }

  // Calculate mean of array
  mean(arr) {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  // Calculate standard deviation
  standardDeviation(arr) {
    const avg = this.mean(arr);
    const squareDiffs = arr.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  // Calculate Z-scores
  calculateZScores(data) {
    const avg = this.mean(data);
    const std = this.standardDeviation(data);
    return data.map(val => Math.abs((val - avg) / std));
  }

  // Linear regression for slope calculation
  linearRegression(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  // Calculate rolling means
  calculateRollingMeans(data) {
    const rollingMeans = [];
    for (let i = 0; i < data.length; i++) {
      const startIdx = Math.max(0, i - this.windowSize + 1);
      const window = data.slice(startIdx, i + 1);
      rollingMeans.push(this.mean(window));
    }
    return rollingMeans;
  }

  // Calculate rolling slopes
  calculateRollingSlopes(data, timePeriods) {
    const rollingSlopes = [];
    for (let i = 0; i < data.length; i++) {
      const startIdx = Math.max(0, i - this.windowSize + 1);
      const windowData = data.slice(startIdx, i + 1);
      const windowTime = timePeriods.slice(startIdx, i + 1);
      
      if (windowData.length > 1) {
        const slope = this.linearRegression(windowTime, windowData);
        rollingSlopes.push(slope);
      } else {
        rollingSlopes.push(0);
      }
    }
    return rollingSlopes;
  }

  // Detect trend changes
  detectSlopeChanges(rollingSlopes) {
    if (rollingSlopes.length < 2) return [];
    
    const trendChanges = [];
    for (let i = 1; i < rollingSlopes.length; i++) {
      const slopeDiff = Math.abs(rollingSlopes[i] - rollingSlopes[i - 1]);
      const signChange = rollingSlopes[i] * rollingSlopes[i - 1] < 0;
      const magnitudeChange = slopeDiff > this.minChangeMagnitude;
      
      if (signChange || magnitudeChange) {
        trendChanges.push(i);
      }
    }
    return trendChanges;
  }

  // Detect sudden changes
  detectSuddenChanges(data) {
    if (data.length < 2) return [];
    
    const differences = data.slice(1).map((val, i) => val - data[i]);
    const diffStd = this.standardDeviation(differences);
    const threshold = diffStd * this.sensitivity;
    
    const suddenChanges = [];
    differences.forEach((diff, i) => {
      if (Math.abs(diff) > threshold) {
        suddenChanges.push(i + 1);
      }
    });
    
    return suddenChanges;
  }

  // Main detection method
  detectTrendChanges(data, statName, timePeriods = null) {
    if (data.length < this.windowSize) {
      return {
        error: `Insufficient data points. Need at least ${this.windowSize} points.`,
        dataLength: data.length
      };
    }

    if (!timePeriods) {
      timePeriods = Array.from({ length: data.length }, (_, i) => i + 1);
    }

    const rollingMeans = this.calculateRollingMeans(data);
    const rollingSlopes = this.calculateRollingSlopes(data, timePeriods);
    const zScores = this.calculateZScores(data);
    
    const statisticalAnomalies = zScores
      .map((score, index) => ({ score, index }))
      .filter(item => item.score > this.sensitivity)
      .map(item => item.index);
    
    const trendChanges = this.detectSlopeChanges(rollingSlopes);
    const suddenChanges = this.detectSuddenChanges(data);
    
    const allAnomalies = [...new Set([...statisticalAnomalies, ...trendChanges, ...suddenChanges])].sort();
    
    const anomalyDetails = this.classifyAnomalies(data, rollingSlopes, allAnomalies, timePeriods, zScores);
    
    return {
      statName,
      data,
      timePeriods,
      anomalies: allAnomalies,
      anomalyDetails,
      rollingMeans,
      rollingSlopes,
      zScores,
      summary: this.generateSummary(anomalyDetails, statName)
    };
  }

  // Classify anomalies with details
  classifyAnomalies(data, rollingSlopes, anomalyIndices, timePeriods, zScores) {
    return anomalyIndices.map(idx => {
      if (idx >= data.length) return null;
      
      const anomalyTypes = [];
      const descriptions = [];
      
      // Statistical outlier check
      if (zScores[idx] > this.sensitivity) {
        anomalyTypes.push('statistical_outlier');
        descriptions.push(`Statistical outlier (z-score: ${zScores[idx].toFixed(2)})`);
      }
      
      // Trend change check
      if (idx > 0 && idx < rollingSlopes.length) {
        const slopeBefore = rollingSlopes[idx - 1];
        const slopeAfter = rollingSlopes[idx];
        
        if (Math.abs(slopeAfter - slopeBefore) > this.minChangeMagnitude) {
          anomalyTypes.push('trend_change');
          const direction = slopeAfter > slopeBefore ? 'increasing' : 'decreasing';
          descriptions.push(`Trend change: ${direction} trend`);
        }
        
        if (slopeBefore * slopeAfter < 0) {
          anomalyTypes.push('trend_reversal');
          descriptions.push('Trend reversal detected');
        }
      }
      
      // Sudden change check
      if (idx > 0) {
        const change = data[idx] - data[idx - 1];
        const differences = data.slice(1).map((val, i) => val - data[i]);
        const diffStd = this.standardDeviation(differences);
        
        if (Math.abs(change) > diffStd * this.sensitivity) {
          anomalyTypes.push('sudden_change');
          const direction = change > 0 ? 'spike' : 'drop';
          descriptions.push(`Sudden ${direction} (${change > 0 ? '+' : ''}${change.toFixed(2)})`);
        }
      }
      
      return {
        index: idx,
        timePeriod: timePeriods[idx],
        value: data[idx],
        types: anomalyTypes,
        description: descriptions.join('; ')
      };
    }).filter(Boolean);
  }

  // Generate summary
  generateSummary(anomalyDetails, statName) {
    if (anomalyDetails.length === 0) {
      return `No significant anomalies detected in ${statName}.`;
    }
    
    const summary = [`Detected ${anomalyDetails.length} anomalies in ${statName}:`];
    anomalyDetails.forEach(detail => {
      summary.push(`- Period ${detail.timePeriod}: ${detail.description} (value: ${detail.value})`);
    });
    
    return summary.join('\n');
  }
}