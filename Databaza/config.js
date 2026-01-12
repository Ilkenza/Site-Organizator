/**
 * Site Organizer Configuration
 * Centralna konfiguracija za sve opcije
 */

const CONFIG = {
    // Dostupne opcije za model naplate
    PRICING_OPTIONS: [
        {
            value: 'fully_free',
            label: 'Fully Free',
            labelSr: 'Potpuno besplatno'
        },
        {
            value: 'paid',
            label: 'Paid',
            labelSr: 'Plaćeno'
        },
        {
            value: 'free_trial',
            label: 'Free Trial',
            labelSr: 'Besplatna probna verzija'
        },
        {
            value: 'freemium',
            label: 'Freemium',
            labelSr: 'Freemium'
        }
    ],

    // Dozvoljene vrijednosti za pricing (za bazu i validaciju)
    PRICING_VALUES: ['fully_free', 'paid', 'free_trial', 'freemium'],

    // Labele za pricing opcije
    getPricingLabel(value, serbian = true) {
        const option = this.PRICING_OPTIONS.find(o => o.value === value);
        return option ? (serbian ? option.labelSr : option.label) : value;
    }
};

// Export za Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
