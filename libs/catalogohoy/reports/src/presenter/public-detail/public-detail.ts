import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IconComponent, SkeletonListComponent } from '@ui';
import { PublicReport } from '../../domain';
import { ReportService } from '../../infrastructure';
import { ReportContent } from '../components/report-content';

@Component({
  selector: 'lib-public-report',
  standalone: true,
  imports: [CommonModule, IconComponent, ReportContent, SkeletonListComponent],
  templateUrl: './public-detail.html',
  styleUrl: './public-detail.css',
})
export default class PublicReportComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ReportService);

  public readonly report = signal<PublicReport | null>(null);
  public readonly isLoading = signal(true);
  public readonly notFound = signal(false);

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }
    const result = await this.service.getPublicByToken(token);
    result
      .mapRight((r) => this.report.set(r))
      .mapLeft(() => this.notFound.set(true));
    this.isLoading.set(false);
  }
}
