'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, Info, Lock, ChevronRight, Search, Globe } from 'lucide-react';
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-primary/10 border border-primary/20 p-6 rounded-xl">
        <div>
          <h2 className="text-2xl font-headline font-bold text-accent">{t.analysisFor} {domain}</h2>
          <p className="text-muted-foreground">
            {t.detectedCount.replace('{total}', results.length.toString()).replace('{count}', detectedCount.toString())}
          </p>
        </div>
        <div className="flex gap-2">
          {isConsistent ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex gap-1 items-center py-1.5 px-3">
              <CheckCircle2 className="w-4 h-4" /> {t.consistent}
            </Badge>
          ) : (
            <Badge variant="destructive" className="flex gap-1 items-center py-1.5 px-3 bg-red-500/20 text-red-400 border-red-500/30">
              <AlertCircle className="w-4 h-4" /> {t.discrepancies}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="font-headline text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-accent" /> {t.sourceComparison}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead>{t.resolver}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead className="hidden md:table-cell">{t.details}</TableHead>
                    <TableHead className="text-right">{t.action}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((res, i) => (
                    <React.Fragment key={i}>
                      <TableRow className="hover:bg-muted/10">
                        <TableCell className="font-medium">{res.resolverName}</TableCell>
                        <TableCell>
                          {res.errorMessage ? (
                            <div className="flex items-center gap-1.5 text-yellow-500 text-sm">
                              <AlertCircle className="w-4 h-4" /> {t.error}
                            </div>
                          ) : res.echConfigDetected ? (
                            <div className="flex items-center gap-1.5 text-green-400 text-sm">
                              <Lock className="w-4 h-4" /> {t.detected}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                              <XCircle className="w-4 h-4" /> {t.notFound}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {res.echConfigDetails ? (
                            <code className="text-[10px] text-accent/70 bg-accent/5 px-2 py-1 rounded">
                              {res.echConfigDetails.version}
                            </code>
                          ) : res.errorMessage ? (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px] inline-block">
                              {res.errorMessage}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '14px',
                              color: '#75E1FF',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginLeft: 'auto',
                            }}
                          >
                            {t.raw}
                            <ChevronRight
                              className="w-4 h-4"
                              style={{
                                transform: expandedRow === i ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s',
                              }}
                            />
                          </button>
                        </TableCell>
                      </TableRow>
                      {expandedRow === i && (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-muted/5">
                            <div className="p-4">
                              <h4 className="text-sm font-medium mb-2">{t.rawData}</h4>
                              <pre
                                style={{
                                  backgroundColor: 'rgba(0,0,0,0.3)',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  overflow: 'auto',
                                  maxHeight: '200px',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                }}
                              >
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

        <div className="space-y-6">
          <Card className="bg-card border-border h-full">
            <CardHeader>
              <CardTitle className="font-headline text-lg flex items-center gap-2">
                <Info className="w-5 h-5 text-accent" /> {t.echParameters}
              </CardTitle>
              <CardDescription>{t.primaryDetails}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.find(r => r.echConfigDetected)?.echConfigDetails ? (
                (() => {
                  const details = results.find(r => r.echConfigDetected)!.echConfigDetails!;
                  return (
                    <div className="space-y-6">
                      {/* Version */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Version</Label>
                        <div className="bg-background/50 p-3 rounded-lg border">
                          <div className="font-mono text-sm text-accent">{details.versionHex}</div>
                          <div className="text-xs text-muted-foreground mt-1">{details.version}</div>
                        </div>
                      </div>

                      {/* Config ID & Public Name */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Config ID</Label>
                          <div className="bg-background/50 p-3 rounded-lg border font-mono text-sm">
                            {details.configId} (0x{details.configId.toString(16).padStart(2, '0')})
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Public Name</Label>
                          <div className="bg-background/50 p-3 rounded-lg border font-mono text-sm">
                            {details.publicName}
                          </div>
                        </div>
                      </div>

                      {/* HPKE Suite */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">HPKE Suite</Label>
                        <div className="bg-background/50 p-3 rounded-lg border space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">KEM</span>
                            <span className="font-mono text-xs">{details.hpkeSuite.kem}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">KDF</span>
                            <span className="font-mono text-xs">{details.hpkeSuite.kdf}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">AEAD</span>
                            <span className="font-mono text-xs">{details.hpkeSuite.aead}</span>
                          </div>
                        </div>
                      </div>

                      {/* Public Key */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Public Key</Label>
                        <div className="bg-background/50 p-3 rounded-lg border space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Algorithm</span>
                            <span className="font-mono">{details.kemId}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Length</span>
                            <span className="font-mono">{details.publicKeyLength} bytes</span>
                          </div>
                          <div className="text-xs text-muted-foreground">Fingerprint</div>
                          <div className="font-mono text-xs break-all text-accent/80">
                            {details.publicKeyFingerprint}
                          </div>
                        </div>
                      </div>

                      {/* Raw ECHConfig (Collapsible) */}
                      <div className="space-y-1.5">
                        <details className="group">
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between bg-background/50 p-3 rounded-lg border hover:bg-background/70 transition-colors">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wider cursor-pointer">Raw ECHConfig</Label>
                              <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                            </div>
                          </summary>
                          <div className="bg-background/50 p-3 rounded-lg border font-mono text-[10px] break-all max-h-32 overflow-y-auto mt-2">
                            {details.rawECHConfig}
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="p-4 rounded-full bg-muted/20">
                    <Search className="w-8 h-8 text-muted-foreground opacity-50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t.noData}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
