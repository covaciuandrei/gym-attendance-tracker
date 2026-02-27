import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { FirebaseService, TrainingType } from '../../../core/services/firebase.service';

@Component({
  selector: 'app-workout-types',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './workout-types.component.html',
  styleUrls: ['./workout-types.component.css']
})
export class WorkoutTypesComponent implements OnInit {
  workoutTypes: TrainingType[] = [];
  isLoading = true;
  isSaving = false;
  
  // Modal state
  showModal = false;
  modalMode: 'create' | 'edit' = 'create';
  editingType: TrainingType | null = null;
  
  // Form fields
  typeName = '';
  typeColor = '#6366f1';
  typeIcon = '🏋️';
  
  // Delete confirmation
  showDeleteConfirm = false;
  typeToDelete: TrainingType | null = null;

  // Predefined colors
  colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6'
  ];

  // Predefined icons
  icons = [
    '🏋️', '🏃', '🚴', '🧘', '🥊', '🏊', '⚽', '🎾', '🏀', '💪',
    '🤸', '🚣', '⛹️', '🤾', '🏌️', '🧗', '🎯', '🔥', '⭐', '🌟'
  ];

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadWorkoutTypes();
  }

  async loadWorkoutTypes() {
    this.isLoading = true;
    const user = this.authService.currentUser;
    if (!user) {
      this.isLoading = false;
      return;
    }

    try {
      this.workoutTypes = await this.firebaseService.getTrainingTypes(user.uid);
    } catch (error) {
      console.error('Error loading workout types:', error);
    }
    this.isLoading = false;
  }

  openCreateModal() {
    this.modalMode = 'create';
    this.typeName = '';
    this.typeColor = '#6366f1';
    this.typeIcon = '🏋️';
    this.editingType = null;
    this.showModal = true;
  }

  openEditModal(type: TrainingType) {
    this.modalMode = 'edit';
    this.editingType = type;
    this.typeName = type.name;
    this.typeColor = type.color;
    this.typeIcon = type.icon || '🏋️';
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingType = null;
  }

  async saveWorkoutType() {
    if (!this.typeName.trim()) return;

    const user = this.authService.currentUser;
    if (!user) return;

    this.isSaving = true;

    try {
      if (this.modalMode === 'create') {
        await this.firebaseService.createTrainingType(user.uid, {
          name: this.typeName.trim(),
          color: this.typeColor,
          icon: this.typeIcon
        });
      } else if (this.editingType) {
        await this.firebaseService.updateTrainingType(user.uid, this.editingType.id, {
          name: this.typeName.trim(),
          color: this.typeColor,
          icon: this.typeIcon
        });
      }
      
      await this.loadWorkoutTypes();
      this.closeModal();
    } catch (error) {
      console.error('Error saving workout type:', error);
    }

    this.isSaving = false;
  }

  openDeleteConfirm(type: TrainingType) {
    this.typeToDelete = type;
    this.showDeleteConfirm = true;
  }

  closeDeleteConfirm() {
    this.showDeleteConfirm = false;
    this.typeToDelete = null;
  }

  async deleteWorkoutType() {
    if (!this.typeToDelete) return;

    const user = this.authService.currentUser;
    if (!user) return;

    this.isSaving = true;

    try {
      await this.firebaseService.deleteTrainingType(user.uid, this.typeToDelete.id);
      await this.loadWorkoutTypes();
      this.closeDeleteConfirm();
    } catch (error) {
      console.error('Error deleting workout type:', error);
    }

    this.isSaving = false;
  }

  selectColor(color: string) {
    this.typeColor = color;
  }

  selectIcon(icon: string) {
    this.typeIcon = icon;
  }
}
