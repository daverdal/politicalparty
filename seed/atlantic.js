/**
 * Atlantic Provinces Seed Data
 * (Newfoundland, Nova Scotia, PEI, New Brunswick)
 */

module.exports = {
    newfoundland: {
        province: { id: 'ca-nl', name: 'Newfoundland and Labrador', code: 'NL' },
        federalRidings: [
            "Avalon", "Bonavista / Gander / Grand Falls / Windsor",
            "Humber / St. Barbe / Baie Verte", "Labrador",
            "Random / Burin / St. Georges", "St. John's East", "St. John's South / Mount Pearl"
        ],
        provincialRidings: [],
        towns: [],
        firstNations: []
    },
    
    novaScotia: {
        province: { id: 'ca-ns', name: 'Nova Scotia', code: 'NS' },
        federalRidings: [
            "Cape Breton / Canso", "Central Nova",
            "Cumberland / Colchester / Musquodoboit Valley", "Dartmouth / Cole Harbour",
            "Halifax", "Halifax West", "Kings / Hants", "Sackville / Eastern Shore",
            "South Shore / St. Margarets", "Sydney / Victoria", "West Nova"
        ],
        provincialRidings: [],
        towns: [],
        firstNations: []
    },
    
    pei: {
        province: { id: 'ca-pe', name: 'Prince Edward Island', code: 'PE' },
        federalRidings: [
            "Cardigan", "Charlottetown", "Egmont", "Malpeque"
        ],
        provincialRidings: [],
        towns: [],
        firstNations: []
    },
    
    newBrunswick: {
        province: { id: 'ca-nb', name: 'New Brunswick', code: 'NB' },
        federalRidings: [
            "Acadie / Bathurst", "Beauséjour", "Fredericton", "Fundy Royal",
            "Madawaska / Restigouche", "Miramichi", "Moncton / Riverview / Dieppe",
            "New Brunswick Southwest", "Saint John", "Tobique / Mactaquac"
        ],
        provincialRidings: [],
        towns: [],
        firstNations: []
    }
};

