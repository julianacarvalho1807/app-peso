import { useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import * as XLSX from "xlsx";
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Save,
  X,
  FileSpreadsheet,
  Scale,
  Layers
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Dashboard Component
const Dashboard = () => {
  const [processingResult, setProcessingResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({ unit_weight: 0, quantity: 0 });

  // File upload handler
  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(10);
    setProcessingResult(null);

    try {
      const formData = new FormData();
      
      // Check if single PDF or multiple images
      if (acceptedFiles.length === 1 && acceptedFiles[0].type === "application/pdf") {
        formData.append("file", acceptedFiles[0]);
        setProcessingProgress(30);
        
        const response = await axios.post(`${API}/process`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        
        setProcessingProgress(100);
        setProcessingResult(response.data);
        setSelectedPage(1);
        toast.success(`Processed ${response.data.total_pages} pages successfully!`);
      } else {
        // Multiple images
        acceptedFiles.forEach(file => {
          formData.append("files", file);
        });
        setProcessingProgress(30);
        
        const response = await axios.post(`${API}/process-multiple`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        
        setProcessingProgress(100);
        setProcessingResult(response.data);
        setSelectedPage(1);
        toast.success(`Processed ${response.data.total_pages} images successfully!`);
      }
    } catch (error) {
      console.error("Processing error:", error);
      toast.error(error.response?.data?.detail || "Failed to process document");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".webp"]
    },
    disabled: isProcessing
  });

  // Edit row handlers
  const handleEditRow = (row) => {
    setEditingRow(row.row_number);
    setEditValues({ unit_weight: row.unit_weight || 0, quantity: row.quantity || 0 });
  };

  const handleSaveRow = () => {
    if (!processingResult || !editingRow) return;

    const updatedPages = processingResult.pages.map(page => {
      if (page.page_number === selectedPage) {
        const updatedRows = page.rows.map(row => {
          if (row.row_number === editingRow) {
            const newRowTotal = (editValues.unit_weight || 0) * (editValues.quantity || 0);
            return {
              ...row,
              unit_weight: editValues.unit_weight,
              quantity: editValues.quantity,
              row_total: Math.round(newRowTotal * 1000) / 1000
            };
          }
          return row;
        });
        
        const newPageTotal = updatedRows.reduce((sum, r) => sum + (r.row_total || 0), 0);
        return {
          ...page,
          rows: updatedRows,
          page_total: Math.round(newPageTotal * 1000) / 1000
        };
      }
      return page;
    });

    const newGrandTotal = updatedPages.reduce((sum, p) => sum + p.page_total, 0);
    
    setProcessingResult({
      ...processingResult,
      pages: updatedPages,
      grand_total: Math.round(newGrandTotal * 1000) / 1000
    });
    
    setEditingRow(null);
    toast.success("Row updated successfully!");
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (!processingResult) return;

    try {
      const response = await axios.post(`${API}/export-excel`, processingResult, {
        responseType: "blob"
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `cutting_report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Excel exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel");
    }
  };

  // Get current page data
  const currentPage = processingResult?.pages?.find(p => p.page_number === selectedPage);

  // Confidence badge component
  const ConfidenceBadge = ({ confidence }) => {
    const config = {
      high: { color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
      medium: { color: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertCircle },
      low: { color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle }
    };
    const { color, icon: Icon } = config[confidence] || config.medium;
    
    return (
      <Badge variant="outline" className={`${color} font-medium`}>
        <Icon className="w-3 h-3 mr-1" />
        {confidence.toUpperCase()}
      </Badge>
    );
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-white" data-testid="dashboard-container">
        {/* Header */}
        <header className="border-b border-border bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0033CC] flex items-center justify-center">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground font-['Chivo',sans-serif]">
                  Cutting Report Processor
                </h1>
                <p className="text-sm text-muted-foreground">
                  Industrial weight calculation tool
                </p>
              </div>
            </div>
            
            {processingResult && (
              <Button 
                onClick={handleExportExcel}
                className="bg-[#0033CC] hover:bg-[#0033CC]/90"
                data-testid="export-excel-btn"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export to Excel
              </Button>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Upload Section */}
          {!processingResult && !isProcessing && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-2 border-dashed hover:border-[#0033CC]/50 transition-colors">
                <CardContent className="p-0">
                  <div
                    {...getRootProps()}
                    className={`p-12 text-center cursor-pointer transition-all ${
                      isDragActive ? "bg-[#0033CC]/5" : "hover:bg-muted/50"
                    }`}
                    data-testid="file-dropzone"
                  >
                    <input {...getInputProps()} data-testid="file-input" />
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2 font-['Chivo',sans-serif]">
                      {isDragActive ? "Drop files here" : "Upload Cutting Report"}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Drag and drop a PDF or multiple images
                    </p>
                    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" /> PDF
                      </span>
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" /> PNG, JPG, WEBP
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <Card className="animate-in fade-in duration-300" data-testid="processing-card">
              <CardContent className="p-12 text-center">
                <Loader2 className="w-16 h-16 mx-auto mb-6 text-[#0033CC] animate-spin" />
                <h2 className="text-2xl font-semibold mb-4 font-['Chivo',sans-serif]">
                  Processing Document
                </h2>
                <p className="text-muted-foreground mb-6">
                  Extracting table data using AI vision...
                </p>
                <Progress value={processingProgress} className="w-64 mx-auto" />
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          {processingResult && !isProcessing && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card data-testid="grand-total-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Grand Total</span>
                      <Scale className="w-5 h-5 text-[#0033CC]" />
                    </div>
                    <p className="text-3xl font-bold font-['JetBrains_Mono',monospace] text-[#0033CC]">
                      {processingResult.grand_total.toFixed(3)} kg
                    </p>
                    {processingResult.reported_grand_total && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Reported: </span>
                        <span className="font-mono">{processingResult.reported_grand_total.toFixed(3)} kg</span>
                        {processingResult.grand_total_difference > 0 && (
                          <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800 border-amber-200">
                            Δ {processingResult.grand_total_difference.toFixed(3)} kg
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="pages-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Total Pages</span>
                      <Layers className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-3xl font-bold font-['JetBrains_Mono',monospace]">
                      {processingResult.total_pages}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="filename-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">File</span>
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium truncate" title={processingResult.filename}>
                      {processingResult.filename}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Processed in {processingResult.processing_time}s
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="reset-card">
                  <CardContent className="p-6 flex flex-col justify-center">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setProcessingResult(null);
                        setSelectedPage(1);
                      }}
                      data-testid="process-new-btn"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Process New Document
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Page Navigator and Data */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Page Thumbnails */}
                <Card className="lg:col-span-3" data-testid="page-thumbnails-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-['Chivo',sans-serif]">Pages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-3 pr-4">
                        {processingResult.pages.map((page) => (
                          <div
                            key={page.page_number}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedPage === page.page_number
                                ? "border-[#0033CC] bg-[#0033CC]/5"
                                : "border-border hover:border-[#0033CC]/50"
                            }`}
                            onClick={() => setSelectedPage(page.page_number)}
                            data-testid={`page-thumbnail-${page.page_number}`}
                          >
                            <div className="flex items-center gap-3">
                              {page.thumbnail_base64 ? (
                                <img
                                  src={`data:image/jpeg;base64,${page.thumbnail_base64}`}
                                  alt={`Page ${page.page_number}`}
                                  className="w-12 h-16 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-12 h-16 bg-muted rounded border flex items-center justify-center">
                                  <FileText className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">Page {page.page_number}</p>
                                <p className="text-sm font-mono text-muted-foreground">
                                  {page.page_total.toFixed(3)} kg
                                </p>
                                <ConfidenceBadge confidence={page.confidence} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Data Table */}
                <Card className="lg:col-span-9" data-testid="data-table-card">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg font-['Chivo',sans-serif]">
                          Page {selectedPage} Data
                        </CardTitle>
                        <CardDescription>
                          {currentPage?.rows?.length || 0} rows extracted
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={selectedPage <= 1}
                          onClick={() => setSelectedPage(p => p - 1)}
                          data-testid="prev-page-btn"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium px-2">
                          {selectedPage} / {processingResult.total_pages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={selectedPage >= processingResult.total_pages}
                          onClick={() => setSelectedPage(p => p + 1)}
                          data-testid="next-page-btn"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-16">#</TableHead>
                            <TableHead className="bg-[#0033CC]/10 font-semibold">
                              Unit Weight (kg)
                            </TableHead>
                            <TableHead className="bg-[#0033CC]/10 font-semibold">
                              Quantity
                            </TableHead>
                            <TableHead>Raw Value</TableHead>
                            <TableHead className="font-semibold">Row Total (kg)</TableHead>
                            <TableHead className="w-24">Confidence</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentPage?.rows?.map((row) => (
                            <TableRow 
                              key={row.row_number}
                              className={row.has_warning ? "bg-amber-50" : ""}
                              data-testid={`row-${row.row_number}`}
                            >
                              <TableCell className="font-mono text-muted-foreground">
                                {row.row_number}
                              </TableCell>
                              <TableCell className="font-mono bg-[#0033CC]/5">
                                {editingRow === row.row_number ? (
                                  <Input
                                    type="number"
                                    step="0.001"
                                    value={editValues.unit_weight}
                                    onChange={(e) => setEditValues(v => ({
                                      ...v,
                                      unit_weight: parseFloat(e.target.value) || 0
                                    }))}
                                    className="h-8 w-24 font-mono"
                                    data-testid="edit-weight-input"
                                  />
                                ) : (
                                  row.unit_weight?.toFixed(3) || "-"
                                )}
                              </TableCell>
                              <TableCell className="font-mono bg-[#0033CC]/5">
                                {editingRow === row.row_number ? (
                                  <Input
                                    type="number"
                                    value={editValues.quantity}
                                    onChange={(e) => setEditValues(v => ({
                                      ...v,
                                      quantity: parseInt(e.target.value) || 0
                                    }))}
                                    className="h-8 w-20 font-mono"
                                    data-testid="edit-quantity-input"
                                  />
                                ) : (
                                  row.quantity || "-"
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground font-mono text-sm">
                                {row.quantity_raw || "-"}
                              </TableCell>
                              <TableCell className="font-mono font-semibold">
                                {editingRow === row.row_number ? (
                                  <span className="text-muted-foreground">
                                    {((editValues.unit_weight || 0) * (editValues.quantity || 0)).toFixed(3)}
                                  </span>
                                ) : (
                                  row.row_total?.toFixed(3) || "-"
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <ConfidenceBadge confidence={row.confidence} />
                                  {row.has_warning && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {row.warning_message}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {editingRow === row.row_number ? (
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-emerald-600"
                                      onClick={handleSaveRow}
                                      data-testid="save-edit-btn"
                                    >
                                      <Save className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-red-600"
                                      onClick={handleCancelEdit}
                                      data-testid="cancel-edit-btn"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handleEditRow(row)}
                                    data-testid={`edit-row-${row.row_number}-btn`}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Page Summary */}
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-sm text-muted-foreground">Page Total: </span>
                            <span className="text-xl font-bold font-mono">
                              {currentPage?.page_total?.toFixed(3) || 0} kg
                            </span>
                          </div>
                          {currentPage?.reported_total && (
                            <>
                              <Separator orientation="vertical" className="h-8" />
                              <div>
                                <span className="text-sm text-muted-foreground">Reported: </span>
                                <span className="text-lg font-mono">
                                  {currentPage.reported_total.toFixed(3)} kg
                                </span>
                              </div>
                              {currentPage.total_difference > 0 && (
                                <Badge 
                                  variant="outline" 
                                  className={`${
                                    currentPage.total_difference > 1 
                                      ? "bg-red-100 text-red-800 border-red-200" 
                                      : "bg-amber-100 text-amber-800 border-amber-200"
                                  }`}
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Difference: {currentPage.total_difference.toFixed(3)} kg
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        <ConfidenceBadge confidence={currentPage?.confidence || "medium"} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Grand Total Footer */}
              <Card className="bg-[#0033CC] text-white" data-testid="grand-total-footer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#0033CC]/60 text-white/70 text-sm font-medium mb-1">
                        GRAND TOTAL (All Pages)
                      </p>
                      <p className="text-4xl font-bold font-['JetBrains_Mono',monospace]">
                        {processingResult.grand_total.toFixed(3)} kg
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/70 text-sm">
                        {processingResult.total_pages} pages processed
                      </p>
                      {processingResult.reported_grand_total && (
                        <div className="mt-2">
                          <p className="text-white/70 text-sm">
                            Reported: {processingResult.reported_grand_total.toFixed(3)} kg
                          </p>
                          {processingResult.grand_total_difference > 0 && (
                            <Badge className="mt-1 bg-white/20 text-white border-white/30">
                              Δ {processingResult.grand_total_difference.toFixed(3)} kg
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>

        <Toaster position="top-right" richColors />
      </div>
    </TooltipProvider>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
