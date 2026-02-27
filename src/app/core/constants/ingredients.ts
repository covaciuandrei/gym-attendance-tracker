export interface IngredientOption {
    id: string;
    name: string;
    defaultUnit: string;
    category: 'Vitamin' | 'Mineral' | 'Sports' | 'Other';
}

export const COMMON_INGREDIENTS: IngredientOption[] = [
    // Vitamins
    { id: 'vitamin_a', name: 'Vitamin A', defaultUnit: 'IU', category: 'Vitamin' },
    { id: 'vitamin_b1', name: 'Vitamin B1 (Thiamine)', defaultUnit: 'mg', category: 'Vitamin' },
    { id: 'vitamin_b2', name: 'Vitamin B2 (Riboflavin)', defaultUnit: 'mg', category: 'Vitamin' },
    { id: 'vitamin_b3', name: 'Vitamin B3 (Niacin)', defaultUnit: 'mg', category: 'Vitamin' },
    { id: 'vitamin_b5', name: 'Vitamin B5 (Pantothenic Acid)', defaultUnit: 'mg', category: 'Vitamin' },
    { id: 'vitamin_b6', name: 'Vitamin B6 (Pyridoxine)', defaultUnit: 'mg', category: 'Vitamin' },
    { id: 'vitamin_b7', name: 'Vitamin B7 (Biotin)', defaultUnit: 'mcg', category: 'Vitamin' },
    { id: 'vitamin_b9', name: 'Vitamin B9 (Folate)', defaultUnit: 'mcg', category: 'Vitamin' },
    { id: 'vitamin_b12', name: 'Vitamin B12', defaultUnit: 'mcg', category: 'Vitamin' },
    { id: 'vitamin_c', name: 'Vitamin C', defaultUnit: 'mg', category: 'Vitamin' },
    { id: 'vitamin_d3', name: 'Vitamin D3', defaultUnit: 'IU', category: 'Vitamin' },
    { id: 'vitamin_e', name: 'Vitamin E', defaultUnit: 'IU', category: 'Vitamin' },
    { id: 'vitamin_k2', name: 'Vitamin K2', defaultUnit: 'mcg', category: 'Vitamin' },

    // Minerals
    { id: 'calcium', name: 'Calcium', defaultUnit: 'mg', category: 'Mineral' },
    { id: 'chromium', name: 'Chromium', defaultUnit: 'mcg', category: 'Mineral' },
    { id: 'copper', name: 'Copper', defaultUnit: 'mg', category: 'Mineral' },
    { id: 'iodine', name: 'Iodine', defaultUnit: 'mcg', category: 'Mineral' },
    { id: 'iron', name: 'Iron', defaultUnit: 'mg', category: 'Mineral' },
    { id: 'magnesium', name: 'Magnesium', defaultUnit: 'mg', category: 'Mineral' },
    { id: 'manganese', name: 'Manganese', defaultUnit: 'mg', category: 'Mineral' },
    { id: 'molybdenum', name: 'Molybdenum', defaultUnit: 'mcg', category: 'Mineral' },
    { id: 'potassium', name: 'Potassium', defaultUnit: 'mg', category: 'Mineral' },
    { id: 'selenium', name: 'Selenium', defaultUnit: 'mcg', category: 'Mineral' },
    { id: 'sodium', name: 'Sodium', defaultUnit: 'mg', category: 'Mineral' },
    { id: 'zinc', name: 'Zinc', defaultUnit: 'mg', category: 'Mineral' },

    // Sports & Others
    { id: 'creatine', name: 'Creatine Monohydrate', defaultUnit: 'g', category: 'Sports' },
    { id: 'whey_protein', name: 'Whey Protein', defaultUnit: 'g', category: 'Sports' },
    { id: 'casein_protein', name: 'Casein Protein', defaultUnit: 'g', category: 'Sports' },
    { id: 'bcaas', name: 'BCAAs', defaultUnit: 'g', category: 'Sports' },
    { id: 'caffeine', name: 'Caffeine', defaultUnit: 'mg', category: 'Sports' },
    { id: 'beta_alanine', name: 'Beta Alanine', defaultUnit: 'g', category: 'Sports' },
    { id: 'citrulline', name: 'L-Citrulline', defaultUnit: 'g', category: 'Sports' },
    { id: 'glutamine', name: 'Glutamine', defaultUnit: 'g', category: 'Sports' },
    { id: 'omega_3', name: 'Omega-3 (Fish Oil)', defaultUnit: 'g', category: 'Other' },
    { id: 'ashwagandha', name: 'Ashwagandha', defaultUnit: 'mg', category: 'Other' },
    { id: 'melatonin', name: 'Melatonin', defaultUnit: 'mg', category: 'Other' },
    { id: 'collagen', name: 'Collagen', defaultUnit: 'g', category: 'Other' }
];
