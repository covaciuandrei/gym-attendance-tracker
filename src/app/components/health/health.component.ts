import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FirebaseService, SupplementProduct, SupplementLog } from '../../services/firebase.service';
import { SupplementFormComponent } from './supplement-form/supplement-form.component';
import { AuthService } from '../../services/auth.service';

interface GroupedLog {
    productId: string;
    productName: string;
    productBrand: string;
    totalServings: number;
    logs: SupplementLog[];
}

@Component({
    selector: 'app-health',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, SupplementFormComponent],
    templateUrl: './health.component.html',
    styleUrls: ['./health.component.css']
})
export class HealthComponent implements OnInit {
    userId: string | null = null;
    products: SupplementProduct[] = [];
    todayLogs: SupplementLog[] = [];

    showForm = false;
    productToEdit: SupplementProduct | null = null;
    viewMode: 'today' | 'my_supplements' | 'all_supplements' = 'today'; // Start with Today view

    constructor(
        private firebaseService: FirebaseService,
        private authService: AuthService
    ) { }

    get myProducts(): SupplementProduct[] {
        if (!this.userId) return [];
        return this.products.filter(p => p.createdBy === this.userId);
    }

    async ngOnInit() {
        this.authService.currentUser$.subscribe(user => {
            if (user) {
                this.userId = user.uid;
                this.loadData();
            }
        });
    }

    async loadData() {
        if (!this.userId) return;

        // Auto-seed global ingredients if missing (One-time setup for the app)
        const ingredients = await this.firebaseService.getIngredients();
        if (ingredients.length === 0) {
            console.log('🌱 Seeding database with default ingredients...');
            await this.firebaseService.seedIngredients();
        }

        // Fetch all products (eventually this should be searched/paginated)
        this.products = await this.firebaseService.getProducts();
        await this.loadTodayLogs();
    }

    async loadTodayLogs() {
        if (!this.userId) return;
        const today = new Date().toISOString().split('T')[0];
        const [year, month] = today.split('-').map(Number);

        // logs is a list of entries
        const monthLogs = await this.firebaseService.getSupplementLogs(this.userId, year, month);
        this.todayLogs = monthLogs.filter(l => l.date === today);
    }

    openAddForm() {
        this.productToEdit = null;
        this.showForm = true;
    }

    startEdit(product: SupplementProduct) {
        this.productToEdit = product;
        this.showForm = true;
    }

    // Delete confirmation modal
    showDeleteConfirm = false;
    productToDelete: SupplementProduct | null = null;

    deleteProduct(product: SupplementProduct) {
        // Show custom modal instead of browser confirm
        this.productToDelete = product;
        this.showDeleteConfirm = true;
    }

    cancelDelete() {
        this.showDeleteConfirm = false;
        this.productToDelete = null;
    }

    async confirmDelete() {
        if (!this.productToDelete) return;

        try {
            await this.firebaseService.deleteProduct(this.productToDelete.id);
            await this.loadData(); // Refresh list
        } catch (e) {
            console.error("Delete failed", e);
        }

        this.showDeleteConfirm = false;
        this.productToDelete = null;
    }

    closeForm() {
        this.showForm = false;
        this.productToEdit = null;
    }

    onFormSaved(id: string) {
        this.showForm = false;
        this.productToEdit = null;
        this.loadData();
    }

    async takeSupplement(product: SupplementProduct) {
        if (!this.userId) return;
        const today = new Date().toISOString().split('T')[0];

        // Default 1 serving
        const servings = product.servingsPerDayDefault || 1;

        // Pass snapshot data (name, brand)
        await this.firebaseService.logSupplement(
            this.userId,
            today,
            product.id,
            servings,
            { name: product.name, brand: product.brand }
        );
        await this.loadTodayLogs();
    }

    // Helper to sum servings for a product today
    getTodayServings(productId: string): number {
        return this.todayLogs
            .filter(l => l.productId === productId)
            .reduce((sum, l) => sum + l.servingsTaken, 0);
    }

    getProductName(productId: string): string {
        const p = this.products.find(x => x.id === productId);
        return p ? p.name : 'Unknown Product';
    }

    setView(mode: 'today' | 'my_supplements' | 'all_supplements') {
        this.viewMode = mode;
    }

    // Helper for template
    getProductBrand(productId: string): string {
        const p = this.products.find(x => x.id === productId);
        return p?.brand || '';
    }

    getCurrentDate(): string {
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return new Date().toLocaleDateString('en-US', options);
    }

    getGroupedTodayLogs(): GroupedLog[] {
        const grouped = new Map<string, GroupedLog>();

        for (const log of this.todayLogs) {
            if (grouped.has(log.productId)) {
                const existing = grouped.get(log.productId)!;
                existing.totalServings += log.servingsTaken;
                existing.logs.push(log);
            } else {
                // Try to resolve name from log first (snapshot), then from live products
                let name = log.productName;
                let brand = log.productBrand || '';

                if (!name) {
                    const p = this.products.find(p => p.id === log.productId);
                    name = p ? p.name : 'Unknown Product';
                    brand = p ? p.brand : '';
                }

                grouped.set(log.productId, {
                    productId: log.productId,
                    productName: name || 'Unknown Product',
                    productBrand: brand,
                    totalServings: log.servingsTaken,
                    logs: [log]
                });
            }
        }

        return Array.from(grouped.values());
    }
}
