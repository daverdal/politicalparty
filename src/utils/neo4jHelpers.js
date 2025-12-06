/**
 * Neo4j Helper Utilities
 * Common functions for working with Neo4j data types
 */

/**
 * Convert Neo4j DateTime to ISO string
 */
function toISODate(neo4jDate) {
    if (!neo4jDate) return null;
    if (typeof neo4jDate === 'string') return neo4jDate;
    if (neo4jDate.toStandardDate) {
        return neo4jDate.toStandardDate().toISOString();
    }
    // Handle raw integer year
    if (typeof neo4jDate === 'object' && neo4jDate.year) {
        const year = neo4jDate.year.low || neo4jDate.year;
        const month = (neo4jDate.month?.low || neo4jDate.month || 1);
        const day = (neo4jDate.day?.low || neo4jDate.day || 1);
        const hour = (neo4jDate.hour?.low || neo4jDate.hour || 0);
        const minute = (neo4jDate.minute?.low || neo4jDate.minute || 0);
        const second = (neo4jDate.second?.low || neo4jDate.second || 0);
        return new Date(year, month - 1, day, hour, minute, second).toISOString();
    }
    return null;
}

/**
 * Convert Neo4j Integer to JavaScript number
 */
function toNumber(neo4jInt) {
    if (neo4jInt === null || neo4jInt === undefined) return 0;
    if (typeof neo4jInt === 'number') return neo4jInt;
    if (neo4jInt.toNumber) return neo4jInt.toNumber();
    if (neo4jInt.low !== undefined) return neo4jInt.low;
    return parseInt(neo4jInt) || 0;
}

/**
 * Extract properties from a Neo4j node
 */
function nodeToObject(node) {
    if (!node) return null;
    return node.properties || node;
}

/**
 * Convert array of Neo4j records to plain objects
 */
function recordsToArray(records, key) {
    return records.map(record => nodeToObject(record.get(key)));
}

module.exports = {
    toISODate,
    toNumber,
    nodeToObject,
    recordsToArray
};

