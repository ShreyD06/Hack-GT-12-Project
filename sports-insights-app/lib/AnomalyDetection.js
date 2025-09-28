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

  // Generate human-readable narrative from results
  generateNarrative(results) {
    if (results.error) {
      return "Not enough data to analyze trends yet.";
    }

    const { statName, anomalyDetails, data, rollingSlopes } = results;
    const statements = [];
    
    // Convert stat names to more readable formats
    const readableStatName = this.convertStatName(statName);
    
    if (anomalyDetails.length === 0) {
      statements.push(`${readableStatName} has remained fairly consistent throughout the game.`);
      return statements;
    }

    // Group anomalies by type for better narrative flow
    const trendChanges = anomalyDetails.filter(a => a.types.includes('trend_change'));
    const trendReversals = anomalyDetails.filter(a => a.types.includes('trend_reversal'));
    const suddenChanges = anomalyDetails.filter(a => a.types.includes('sudden_change'));
    const outliers = anomalyDetails.filter(a => a.types.includes('statistical_outlier'));

    // Generate statements for trend changes
    if (trendChanges.length > 0 || trendReversals.length > 0) {
      statements.push(...this.generateTrendStatements(trendChanges, trendReversals, readableStatName, rollingSlopes));
    }

    // Generate statements for sudden changes
    if (suddenChanges.length > 0) {
      statements.push(...this.generateSuddenChangeStatements(suddenChanges, readableStatName));
    }

    // Generate statements for outliers
    if (outliers.length > 0) {
      statements.push(...this.generateOutlierStatements(outliers, readableStatName, data));
    }

    // Overall game narrative
    // const overallNarrative = this.generateOverallNarrative(results);
    // if (overallNarrative) {
    //   statements.push(overallNarrative);
    // }

    return statements;
  }

  convertStatName(statName) {
    const conversions = {
      'rush attempts': 'rushing',
      'rush_attempts': 'rushing',
      'rushAttempts': 'rushing',
      'rushing': 'rushing',
      
      'pass attempts': 'passing',
      'pass_attempts': 'passing', 
      'passAttempts': 'passing',
      'passing': 'passing',
      
      'first downs': 'first down production',
      'first_downs': 'first down production',
      'firstDowns': 'first down production',
      '1st downs': 'first down production',
      
      'time of possession': 'time of possession',
      'timeOfPossession': 'time of possession',
      'time_of_possession': 'time of possession',
      
      'yards per play': 'offensive efficiency',
      'yards_per_play': 'offensive efficiency',
      'yardsPerPlay': 'offensive efficiency',
      
      'third down conversions': 'third down success',
      'third_down_conversions': 'third down success',
      'thirdDownConversions': 'third down success',
      
      'red zone attempts': 'red zone opportunities',
      'turnovers': 'ball security',
      'sacks allowed': 'pass protection',
      'penalties': 'discipline'
    };
    
    const key = statName.toLowerCase();
    return conversions[key] || statName.toLowerCase();
  }

  generateTrendStatements(trendChanges, trendReversals, statName, rollingSlopes) {
    const statements = [];
    const allTrendAnomalies = [...trendChanges, ...trendReversals].sort((a, b) => a.index - b.index);
    
    if (allTrendAnomalies.length === 0) return statements;

    // Analyze the most recent trend
    const latestAnomaly = allTrendAnomalies[allTrendAnomalies.length - 1];
    const currentSlope = rollingSlopes[latestAnomaly.index];
    
    if (trendReversals.some(r => r.index === latestAnomaly.index)) {
      if (currentSlope > 0) {
        statements.push(`${this.capitalize(statName)} has picked up significantly.`);
      } else {
        statements.push(`${this.capitalize(statName)} has dropped off notably.`);
      }
    } else {
      if (currentSlope > 0.5) {
        statements.push(`The team has been increasing their ${statName}.`);
      } else if (currentSlope < -0.5) {
        statements.push(`${this.capitalize(statName)} has decreased over the last few drives.`);
      } else if (Math.abs(currentSlope) > 0.2) {
        const direction = currentSlope > 0 ? 'uptick' : 'downtick';
        statements.push(`There's been a slight ${direction} in ${statName} recently.`);
      }
    }

    return statements;
  }

  generateSuddenChangeStatements(suddenChanges, statName) {
    const statements = [];
    
    suddenChanges.forEach(change => {
      if (change.description.includes('spike')) {
        if (statName === 'rushing') {
          statements.push(`The team suddenly emphasized the running game.`);
        } else if (statName === 'passing') {
          statements.push(`The offense opened up the passing attack.`);
        } else if (statName === 'first down production') {
          statements.push(`The offense found their rhythm and started moving the chains.`);
        } else {
          statements.push(`There was a sudden surge in ${statName}.`);
        }
      } else if (change.description.includes('drop')) {
        if (statName === 'rushing') {
          statements.push(`The team moved away from the running game.`);
        } else if (statName === 'passing') {
          statements.push(`The passing game stalled.`);
        } else if (statName === 'first down production') {
          statements.push(`The offense struggled to sustain drives.`);
        } else {
          statements.push(`There was a noticeable drop in ${statName}.`);
        }
      }
    });

    return statements;
  }

  generateOutlierStatements(outliers, statName, data) {
    const statements = [];
    const dataAvg = this.mean(data);
    
    outliers.forEach(outlier => {
      const isHigh = outlier.value > dataAvg;
      
      if (isHigh) {
        if (statName === 'rushing') {
          statements.push(`The team heavily featured the running game with ${outlier.value} attempts.`);
        } else if (statName === 'passing') {
          statements.push(`The quarterback was very busy, throwing ${outlier.value} passes.`);
        } else if (statName === 'first down production') {
          statements.push(`The offense was extremely efficient, converting ${outlier.value} first downs.`);
        } else {
          statements.push(`${this.capitalize(statName)} was unusually high at ${outlier.value}.`);
        }
      } else {
        if (statName === 'rushing') {
          statements.push(`The running game was nearly abandoned with only ${outlier.value} attempts.`);
        } else if (statName === 'passing') {
          statements.push(`The passing game was minimal with just ${outlier.value} attempts.`);
        } else if (statName === 'first down production') {
          statements.push(`The offense struggled badly, managing only ${outlier.value} first downs.`);
        } else {
          statements.push(`${this.capitalize(statName)} was surprisingly low at ${outlier.value}.`);
        }
      }
    });

    return statements;
  }

  generateOverallNarrative(results) {
    const { data, rollingSlopes, anomalyDetails } = results;
    
    // Calculate overall trend
    const recentSlopes = rollingSlopes.slice(-3); // Last 3 periods
    const avgRecentSlope = this.mean(recentSlopes);
    const overallSlope = this.linearRegression(
      Array.from({length: data.length}, (_, i) => i + 1), 
      data
    );
    
    if (anomalyDetails.length >= 3) {
      return "This has been a game of significant strategic adjustments and momentum shifts.";
    } else if (Math.abs(overallSlope) > 0.5) {
      const direction = overallSlope > 0 ? 'increasing' : 'decreasing';
      return `Overall, there's been a clear ${direction} trend throughout the game.`;
    } else if (avgRecentSlope > 0.3) {
      return "The trend has been positive in recent drives.";
    } else if (avgRecentSlope < -0.3) {
      return "The recent trend has been concerning.";
    }
    
    return null;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export const anomalyDetect = new FootballAnomalyDetector();