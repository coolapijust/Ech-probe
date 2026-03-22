'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, Lock, ChevronRight, ChevronDown } from 'lucide-react';
import { ResolverResult } from '@/app/actions/dns';
import { useLanguage } from '@/context/LanguageContext';
import { Label } from '@/components/ui/label';

interface ResultsDisplayProps {
  results: ResolverResult[];
  domain: string;
}

/** 平滑展开/收起动画组件，使用 max-height CSS transition，不依赖原生 details 元素 */
function AnimatedCollapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (innerRef.current) {
      setHeight(innerRef.current.scrollHeight);
    }
  }, [children, open]);

  return (
    <div
      style={{
        maxHeight: open ? `${height}px` : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/** 表格行内嵌展开区域，带滑入动画 */
function ExpandableRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden border-t border-border/30 bg-muted/10">
      {children}
    </div>
  );
}

/** Raw ECHConfig 可折叠块 */
function RawECHCollapsible({ value, label }: { value: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-background/50 p-1.5 lg:p-2 hover:bg-background/70 transition-colors"
      >
        <Label className="text-[9px] lg:text-[10px] text-muted-foreground uppercase cursor-pointer">
          {label}
        </Label>
        <ChevronDown
          className="w-3 h-3 text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <AnimatedCollapsible open={open}>
        <div className="bg-background/50 p-1.5 lg:p-2 font-mono text-[8px] lg:text-[9px] break-all max-h-32 overflow-y-auto border-t border-border/30">
          {value || '—'}
        </div>
      </AnimatedCollapsible>
    </div>
  );
}

export function ResultsDisplay({ results, domain }: ResultsDisplayProps) {
  const { t } = useLanguage();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  if (results.length === 0) return null;

  const detectedCount = results.filter(r => r.echConfigDetected).length;
  const isConsistent = results.every(r => r.echConfigDetected === results[0].echConfigDetected);
  const hasEchData = results.some(r => r.echConfigDetected);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid lg:grid-cols-12 gap-4 lg:gap-6">

        {/* Left Column - Source Comparison (7 columns) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Header Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-3 lg:p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 lg:gap-3">
                <div>
                  <h2 className="text-base lg:text-lg font-bold text-accent">{t.analysisFor} {domain}</h2>
                  <p className="text-xs lg:text-sm text-muted-foreground">
                    {t.detectedCount.replace('{total}', results.length.toString()).replace('{count}', detectedCount.toString())}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isConsistent ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex gap-1 items-center py-1 px-2 text-xs">
                      <CheckCircle2 className="w-3 h-3" /> {t.consistent}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex gap-1 items-center py-1 px-2 text-xs bg-red-500/20 text-red-400 border-red-500/30">
                      <AlertCircle className="w-3 h-3" /> {t.discrepancies}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Source Comparison Table */}
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="border-b bg-muted/30 py-2 lg:py-3 px-3 lg:px-4">
              <CardTitle className="text-sm lg:text-base">{t.sourceComparison}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-[80px] lg:w-[100px] text-xs">{t.resolver}</TableHead>
                    <TableHead className="w-[60px] lg:w-[80px] text-xs">{t.status}</TableHead>
                    <TableHead className="hidden sm:table-cell text-xs">{t.details}</TableHead>
                    <TableHead className="text-right w-[60px] lg:w-[80px] text-xs">{t.action}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((res, i) => (
                    <React.Fragment key={i}>
                      <TableRow className="hover:bg-muted/10">
                        <TableCell className="font-medium text-xs lg:text-sm py-2 lg:py-3">{res.resolverName}</TableCell>
                        <TableCell className="py-2 lg:py-3">
                          {res.errorMessage ? (
                            <div className="flex items-center gap-1 text-yellow-500 text-[10px] lg:text-xs">
                              <AlertCircle className="w-3 h-3" /> {t.error}
                            </div>
                          ) : res.echConfigDetected ? (
                            <div className="flex items-center gap-1 text-green-400 text-[10px] lg:text-xs">
                              <Lock className="w-3 h-3" /> {t.detected}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-muted-foreground text-[10px] lg:text-xs">
                              <XCircle className="w-3 h-3" /> {t.notFound}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-2 lg:py-3">
                          {res.echConfigDetails ? (
                            <code className="text-[9px] lg:text-[10px] text-accent/70 bg-accent/5 px-1.5 lg:px-2 py-0.5 rounded">
                              {res.echConfigDetails.version}
                            </code>
                          ) : res.errorMessage ? (
                            <span className="text-[10px] lg:text-xs text-muted-foreground truncate max-w-[120px] lg:max-w-[200px] inline-block">
                              {res.errorMessage}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right py-2 lg:py-3">
                          <button
                            onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                            className="text-accent text-[10px] lg:text-xs flex items-center gap-1 ml-auto hover:underline p-1"
                          >
                            {t.raw}
                            <ChevronRight
                              className="w-3 h-3 transition-transform duration-200"
                              style={{ transform: expandedRow === i ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            />
                          </button>
                        </TableCell>
                      </TableRow>
                      {/* 展开行：用 AnimatedCollapsible 替代原生 details */}
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={4} className="p-0 border-0">
                          <AnimatedCollapsible open={expandedRow === i}>
                            <ExpandableRow>
                              <div className="p-2 lg:p-3">
                                <h4 className="text-[10px] lg:text-xs font-medium mb-1 lg:mb-2">{t.rawData}</h4>
                                <pre className="bg-black/30 p-2 lg:p-3 rounded text-[10px] lg:text-[11px] overflow-auto max-h-[100px] lg:max-h-[150px] whitespace-pre-wrap break-all">
                                  {res.rawResponse || t.noData}
                                </pre>
                              </div>
                            </ExpandableRow>
                          </AnimatedCollapsible>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - ECH Parameters (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          {hasEchData ? (
            <Card className="bg-card border-border h-full">
              <CardHeader className="border-b bg-muted/30 py-2 lg:py-3 px-3 lg:px-4">
                <CardTitle className="text-sm lg:text-base">{t.echParameters}</CardTitle>
                <CardDescription className="text-[10px] lg:text-xs">{t.primaryDetails}</CardDescription>
              </CardHeader>
              <CardContent className="p-3 lg:p-4 space-y-2 lg:space-y-3">
                {(() => {
                  const details = results.find(r => r.echConfigDetected)!.echConfigDetails!;
                  const rawContent =
                    details.rawECHConfig ||
                    results.find(r => r.echConfigDetected)?.rawResponse ||
                    '';
                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] lg:text-[10px] text-muted-foreground uppercase">Version</Label>
                          <div className="bg-background/50 p-1.5 lg:p-2 rounded border">
                            <div className="font-mono text-[10px] lg:text-xs text-accent">{details.versionHex}</div>
                            <div className="text-[9px] lg:text-[10px] text-muted-foreground">{details.version}</div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] lg:text-[10px] text-muted-foreground uppercase">Config ID</Label>
                          <div className="bg-background/50 p-1.5 lg:p-2 rounded border font-mono text-[10px] lg:text-xs">
                            {details.configId}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[9px] lg:text-[10px] text-muted-foreground uppercase">Public Name</Label>
                        <div className="bg-background/50 p-1.5 lg:p-2 rounded border font-mono text-[10px] lg:text-xs truncate">
                          {details.publicName}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[9px] lg:text-[10px] text-muted-foreground uppercase">HPKE Suite</Label>
                        <div className="bg-background/50 p-1.5 lg:p-2 rounded border space-y-0.5 lg:space-y-1">
                          <div className="flex justify-between text-[9px] lg:text-[10px]">
                            <span className="text-muted-foreground">KEM</span>
                            <span className="font-mono">{details.hpkeSuite.kem}</span>
                          </div>
                          <div className="flex justify-between text-[9px] lg:text-[10px]">
                            <span className="text-muted-foreground">KDF</span>
                            <span className="font-mono">{details.hpkeSuite.kdf}</span>
                          </div>
                          <div className="flex justify-between text-[9px] lg:text-[10px]">
                            <span className="text-muted-foreground">AEAD</span>
                            <span className="font-mono">{details.hpkeSuite.aead}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[9px] lg:text-[10px] text-muted-foreground uppercase">Public Key</Label>
                        <div className="bg-background/50 p-1.5 lg:p-2 rounded border">
                          <div className="flex justify-between text-[9px] lg:text-[10px] mb-0.5 lg:mb-1">
                            <span className="text-muted-foreground">{details.kemId}</span>
                            <span className="font-mono">{details.publicKeyLength} bytes</span>
                          </div>
                          <div className="font-mono text-[8px] lg:text-[9px] break-all text-accent/80">
                            {details.publicKeyFingerprint}
                          </div>
                        </div>
                      </div>

                      {/* Raw ECHConfig - 自定义动画折叠，替代原生 details */}
                      <RawECHCollapsible value={rawContent} label="Raw ECHConfig" />
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {t.noData}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
