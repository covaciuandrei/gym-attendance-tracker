import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberInputDirective, formatNumber, parseNumberText } from './number-input.directive';

@Component({
  standalone: true,
  imports: [NumberInputDirective],
  template: `<input appNum [num]="value" (numChange)="onChange($event)" />`,
})
class HostComponent {
  value: number | null = 5;
  changes: (number | null)[] = [];

  onChange(next: number | null): void {
    this.changes.push(next);
    this.value = next;
  }
}

describe('parseNumberText / formatNumber', () => {
  it('parses decimal points and commas', () => {
    expect(parseNumberText('80.5')).toBe(80.5);
    expect(parseNumberText('80,5')).toBe(80.5);
    expect(parseNumberText(' 7 ')).toBe(7);
    expect(parseNumberText('12.')).toBe(12);
    expect(parseNumberText('.5')).toBe(0.5);
  });

  it('rejects anything that is not a plain non-negative number', () => {
    for (const bad of ['', '.', ',', 'abc', '1,2,3', '1.2.3', '-4', '1e3', '12 5']) {
      expect(parseNumberText(bad)).withContext(bad).toBeNull();
    }
  });

  it('formats without noise', () => {
    expect(formatNumber(80.4)).toBe('80.4');
    expect(formatNumber(12.3456)).toBe('12.35');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(undefined)).toBe('');
    expect(formatNumber(Number.NaN)).toBe('');
  });
});

describe('NumberInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let input: HTMLInputElement;

  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  it('shows the initial value', () => {
    expect(input.value).toBe('5');
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('emits numbers while typing and never rewrites what was typed', () => {
    type('12,');
    expect(host.changes.at(-1)).toBe(12);
    expect(input.value).toBe('12,');

    type('12,5');
    expect(host.changes.at(-1)).toBe(12.5);
    expect(input.value).toBe('12,5');
  });

  it('keeps an emptied field empty instead of snapping back to 0', () => {
    type('');
    expect(host.changes.at(-1)).toBeNull();
    expect(input.value).toBe('');
    type('3');
    expect(input.value).toBe('3');
    expect(host.value).toBe(3);
  });

  it('rewrites the text when the model changes from outside', () => {
    host.value = 42.5;
    fixture.detectChanges();
    expect(input.value).toBe('42.5');
  });

  it('normalises the text on blur', () => {
    type('12,');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('12');
  });
});
