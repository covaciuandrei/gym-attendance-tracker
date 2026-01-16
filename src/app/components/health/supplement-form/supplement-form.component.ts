import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FirebaseService, Ingredient } from '../../../services/firebase.service';

@Component({
    selector: 'app-supplement-form',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule],
    templateUrl: './supplement-form.component.html',
    styleUrls: ['./supplement-form.component.css']
})
export class SupplementFormComponent implements OnInit {
    @Input() productToEdit: any = null;
    @Input() userId!: string;
    @Output() save = new EventEmitter<string>(); // Returns new product ID
    @Output() cancel = new EventEmitter<void>();

    name = '';
    brand = '';
    // Temporary list for building the product
    ingredients: { name: string; amount: number; unit: string; stdId: string }[] = [];

    // Ingredient Entry
    currentIngredientName = '';
    currentIngredientAmount: number | null = null;
    currentIngredientUnit = 'mg';
    currentIngredientStdId = ''; // Hidden stdId

    // Autocomplete
    filteredOptions: Ingredient[] = [];
    showAutocomplete = false;

    constructor(private firebaseService: FirebaseService) { }

    ngOnInit() {
        if (this.productToEdit) {
            this.name = this.productToEdit.name;
            this.brand = this.productToEdit.brand || '';
            // Deep copy to avoid reference issues
            this.ingredients = JSON.parse(JSON.stringify(this.productToEdit.ingredients || []));
        }
    }

    async onIngredientInput() {
        if (!this.currentIngredientName.trim()) {
            this.filteredOptions = [];
            this.showAutocomplete = false;
            return;
        }

        const term = this.currentIngredientName.toLowerCase();
        // Use Firestore search
        this.filteredOptions = await this.firebaseService.searchIngredients(term);
        this.showAutocomplete = this.filteredOptions.length > 0;
    }

    selectOption(option: Ingredient) {
        this.currentIngredientName = option.name;
        this.currentIngredientUnit = option.defaultUnit;
        this.currentIngredientStdId = option.id;
        this.showAutocomplete = false;
    }

    addIngredient() {
        if (!this.currentIngredientName || !this.currentIngredientAmount) return;

        // If no stdId was selected from autocomplete, we can't accept it in this strict mode?
        // User requirements: "Every ingredient MUST have a stdId"
        // So we should enforce selection or try to match again.
        // For now, if they typed "Vitamin C" and it matches exact name, we can find it.
        // But if they type "My Weird Herb" and it has no stdId, we should probably BLOCK or allow creating new ingredient?
        // The plan says "Users can add more later", implying we might need "Create Ingredient".
        // BUT strict rule: "Every ingredient MUST have a stdId".
        // Let's enforce selection for now or show error if no stdId.

        if (!this.currentIngredientStdId) {
            // Try to find exact match in what was loaded
            const match = this.filteredOptions.find(o => o.name.toLowerCase() === this.currentIngredientName.toLowerCase());
            if (match) {
                this.currentIngredientStdId = match.id;
            } else {
                alert('Please select an ingredient from the list. Custom ingredients need to be added to the database first.');
                return;
            }
        }

        this.ingredients.push({
            name: this.currentIngredientName,
            amount: this.currentIngredientAmount,
            unit: this.currentIngredientUnit,
            stdId: this.currentIngredientStdId
        });

        // Reset inputs
        this.currentIngredientName = '';
        this.currentIngredientAmount = null;
        this.currentIngredientUnit = 'mg';
        this.currentIngredientStdId = '';
        this.showAutocomplete = false;
    }

    removeIngredient(index: number) {
        this.ingredients.splice(index, 1);
    }

    async onSubmit() {
        if (!this.name.trim() || this.ingredients.length === 0) return;

        const data = {
            name: this.name,
            brand: this.brand,
            ingredients: this.ingredients,
            servingsPerDayDefault: 1 // Default
        };

        try {
            if (this.productToEdit) {
                await this.firebaseService.updateProduct(this.productToEdit.id, data);
                this.save.emit(this.productToEdit.id);
            } else {
                const newId = await this.firebaseService.addProduct(this.userId, data);
                this.save.emit(newId);
            }
        } catch (error) {
            console.error('Error saving supplement:', error);
        }
    }

    onCancel() {
        this.cancel.emit();
    }
}
