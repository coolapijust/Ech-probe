'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, Lock, ChevronRight, Search } from 'lucide-react';
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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-primary/10 border border-primary/20 p-4 rounded-xl">
        <div>
          <h2 className="text-xl font-bold text-accent">{t.analysisFor} {domain}</h2>
          <p className="text-sm text-muted-foreground">
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

      {/* Source Comparison Table - Full Width */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="border-b bg-muted/30 py-3">
          <CardTitle className="text-base">{t.sourceComparison}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="w-[100px]">{t.resolver}</TableHead>
                <TableHead className="w-[80px]">{t.status}</TableHead>
                <TableHead className="hidden md:table-cell">{t.details}</TableHead>
                <TableHead className="text-right w-[80px]">{t.action}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((res, i) => (
                <React.Fragment key={i}>
                  <TableRow className="hover:bg-muted/10">
                    <TableCell className="font-medium text-sm">{res.resolverName}</TableCell>
                    <TableCell>
                      {res.errorMessage ? (
                        <div className="flex items-center gap-1 text-yellow-500 text-xs">
                          <AlertCircle className="w-3 h-3" /> {t.error}
                        </div>
                      ) : res.echConfigDetected ? (
                        <div className="flex items-center gap-1 text-green-400 text-xs">
                          <Lock className="w-3 h-3" /> {t.detected}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                          <XCircle className="w-3 h-3" /> {t.notFound}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {res.echConfigDetails ? (
                        <code className="text-[10px] text-accent/70 bg-accent/5 px-2 py-0.5 rounded">
                          {res.echConfigDetails.version}
                        </code>
                      ) : res.errorMessage ? (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] inline-block">
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

      {/* ECH Parameters - Only show if detected */}
      {hasEchData && (
        <Card className="bg-card border-border">
          <CardHeader className="border-b bg-muted/30 py-3">
            <CardTitle className="text-base">{t.echParameters}</CardTitle>
            <CardDescription className="text-xs">{t.primaryDetails}</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {(() => {
              const details = results.find(r => r.echConfigDetected)!.echConfigDetails!;
              return (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Version */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase">Version</Label>
                    <div className="bg-background/50 p-2 rounded border">
                      <div className="font-mono text-xs text-accent">{details.versionHex}</div>
                      <div className="text-[10px] text-muted-foreground">{details.version}</div>
                    </div>
                  </div>

                  {/* Config ID */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase">Config ID</Label>
                    <div className="bg-background/50 p-2 rounded border font-mono text-xs">
                      {details.configId}
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
                    <div className="bg-background/50 p-2 rounded border space-y-0.5">
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

                  {/* Public Key - Full width */}
                  <div className="md:col-span-2 lg:col-span-4 space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase">Public Key</Label>
                    <div className="bg-background/50 p-3 rounded border">
                      <div className="grid grid-cols-3 gap-4 mb-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground">Algorithm</span>
                          <div className="font-mono text-xs">{details.kemId}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Length</span>
                          <div className="font-mono text-xs">{details.publicKeyLength} bytes</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground mb-1">Fingerprint</div>
                      <div className="font-mono text-[10px] break-all text-accent/80">
                        {details.publicKeyFingerprint}
                      </div>
                    </div>
                  </div>

                  {/* Raw ECHConfig - Full width, collapsible */}
                  <div className="md:col-span-2 lg:col-span-4">
                    <details className="group">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center justify-between bg-background/50 p-2 rounded border hover:bg-background/70 transition-colors">
                          <Label className="text-[10px] text-muted-foreground uppercase cursor-pointer">Raw ECHConfig</Label>
                          <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                        </div>
                      </summary>
                      <div className="bg-background/50 p-2 rounded border font-mono text-[9px] break-all max-h-24 overflow-y-auto mt-2">
                        {details.rawECHConfig}
                      </div>
                    </details>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
