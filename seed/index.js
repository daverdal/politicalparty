/**
 * Canada Seed Data - Index
 * Combines all province/territory data
 */

const manitoba = require('./manitoba');
const saskatchewan = require('./saskatchewan');
const alberta = require('./alberta');
const bc = require('./british-columbia');
const ontario = require('./ontario');
const quebec = require('./quebec');
const atlantic = require('./atlantic');
const territories = require('./territories');

module.exports = {
    // Western Canada
    manitoba,
    saskatchewan,
    alberta,
    bc,
    
    // Central Canada
    ontario,
    quebec,
    
    // Atlantic Canada
    newfoundland: atlantic.newfoundland,
    novaScotia: atlantic.novaScotia,
    pei: atlantic.pei,
    newBrunswick: atlantic.newBrunswick,
    
    // Territories
    nwt: territories.nwt,
    nunavut: territories.nunavut,
    yukon: territories.yukon,
    
    // Get all provinces as array
    getAllProvinces() {
        return [
            this.manitoba,
            this.saskatchewan,
            this.alberta,
            this.bc,
            this.ontario,
            this.quebec,
            this.newfoundland,
            this.novaScotia,
            this.pei,
            this.newBrunswick,
            this.nwt,
            this.nunavut,
            this.yukon
        ];
    }
};

