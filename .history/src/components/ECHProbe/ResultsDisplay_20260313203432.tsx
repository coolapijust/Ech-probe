'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, Lock, ChevronRight } from 'lucide-react';
import { ResolverResult } from '@/app/actions/dns';
import { useLanguage } from '@/context/LanguageContext';
import { Label } from '@/components/ui/label';

interface ResultsDisplayProps {
  results: ResolverResult[];
  domain: string;
}

export function ResultsDisplay({ results, domain }: ResultsDisplayProps) {
  const { t } = useLanguage();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  if (results.length === 0) return null;

  const detectedCount = results.filter(r => r.echConfigDetected).length;
  const isConsistent = results.every(r => r.echConfigDetected === results[0].echConfigDetected);
  const hasEchData = results.some(r => r.echConfigDetected);

  return (
    <div className="grid lg:grid-cols-12 gap-3 lg:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Left Column - Source Comparison (7 columns) */}
      <div className="lg:col-span-7 space-y-3 lg:space-y-4">
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
                            "-"
                          )}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                          className="text-accent text-xs flex items-center gap-1 ml-auto hover:underline"
                        >
                          {t.raw}
                          <ChevronRight
                            className="w-3 h-3 transition-transform"
                            style={{ transform: expandedRow === i ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          />
                        </button>
                      </TableCell>
                    </TableRow>
                    {expandedRow === i && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/5">
                          <div className="p-3">
                            <h4 className="text-xs font-medium mb-2">{t.rawData}</h4>
                            <pre className="bg-black/30 p-3 rounded text-[11px] overflow-auto max-h-[150px] whitespace-pre-wrap break-all">
                              {res.rawResponse || t.noData}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - ECH Parameters (5 columns) */}
      <div className="lg:col-span-5">
        {hasEchData ? (
          <Card className="bg-card border-border h-full">
            <CardHeader className="border-b bg-muted/30 py-3">
              <CardTitle className="text-base">{t.echParameters}</CardTitle>
              <CardDescription className="text-xs">{t.primaryDetails}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {(() => {
                const details = results.find(r => r.echConfigDetected)!.echConfigDetails!;
                return (
                  <>
                    {/* Version & Config ID */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">Version</Label>
                        <div className="bg-background/50 p-2 rounded border">
                          <div className="font-mono text-xs text-accent">{details.versionHex}</div>
                          <div className="text-[10px] text-muted-foreground">{details.version}</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">Config ID</Label>
                        <div className="bg-background/50 p-2 rounded border font-mono text-xs">
                          {details.configId}
                        </div>
                      </div>
                    </div>

                    {/* Public Name */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Public Name</Label>
                      <div className="bg-background/50 p-2 rounded border font-mono text-xs truncate">
                        {details.publicName}
                      </div>
                    </div>

                    {/* HPKE Suite */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">HPKE Suite</Label>
                      <div className="bg-background/50 p-2 rounded border space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">KEM</span>
                          <span className="font-mono">{details.hpkeSuite.kem}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">KDF</span>
                          <span className="font-mono">{details.hpkeSuite.kdf}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">AEAD</span>
                          <span className="font-mono">{details.hpkeSuite.aead}</span>
                        </div>
                      </div>
                    </div>

                    {/* Public Key */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Public Key</Label>
                      <div className="bg-background/50 p-2 rounded border">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">{details.kemId}</span>
                          <span className="font-mono">{details.publicKeyLength} bytes</span>
                        </div>
                        <div className="font-mono text-[9px] break-all text-accent/80">
                          {details.publicKeyFingerprint}
                        </div>
                      </div>
                    </div>

                    {/* Raw ECHConfig */}
                    <details className="group">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center justify-between bg-background/50 p-2 rounded border hover:bg-background/70 transition-colors">
                          <Label className="text-[10px] text-muted-foreground uppercase cursor-pointer">Raw ECHConfig</Label>
                          <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                        </div>
                      </summary>
                      <div className="bg-background/50 p-2 rounded border font-mono text-[9px] break-all max-h-20 overflow-y-auto mt-2">
                        {details.rawECHConfig}
                      </div>
                    </details>
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
  );
}
