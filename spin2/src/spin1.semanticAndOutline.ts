"use strict";
// src/spin1.semanticAndOutline.ts

import * as vscode from "vscode";
import { EndOfLine } from "vscode";
//import { Z_UNKNOWN } from "zlib";
import { semanticConfiguration, reloadSemanticConfiguration } from "./spin2.semantic.configuration";
import { DocumentFindings, RememberedComment, eCommentType, RememberedToken } from "./spin.semantic.findings";
import { ParseUtils } from "./spin1.utils";

enum eParseState {
  Unknown = 0,
  inCon,
  inDat,
  inObj,
  inPub,
  inPri,
  inVar,
  inDatPasm,
  inMultiLineComment,
  inMultiLineDocComment,
  inNothing,
}

// ----------------------------------------------------------------------------
//  this file contains both an outline provider
//    and our semantic highlighting provider
//

// ----------------------------------------------------------------------------
//   OUTLINE Provider
//
export class Spin1ConfigDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  private spin1OutlineLogEnabled: boolean = false; // WARNING (REMOVE BEFORE FLIGHT)- change to 'false' - disable before commit
  private spin1OutlineLog: any = undefined;

  public constructor() {
    if (this.spin1OutlineLogEnabled) {
      if (this.spin1OutlineLog === undefined) {
        //Create output channel
        this.spin1OutlineLog = vscode.window.createOutputChannel("Spin1 Outline DEBUG");
        this._logMessage("Spin1 Outline log started.");
      } else {
        this._logMessage("\n\n------------------   NEW FILE ----------------\n\n");
      }
    }
  }

  private parseUtils = new ParseUtils();
  private containerDocSymbol: vscode.DocumentSymbol | undefined = undefined;

  public provideDocumentSymbols(document: vscode.TextDocument, _token: vscode.CancellationToken): Promise<vscode.DocumentSymbol[]> {
    return new Promise((resolve, _reject) => {
      let symbols: vscode.DocumentSymbol[] = [];

      let currState: eParseState = eParseState.inCon; // compiler defaults to CON at start!
      let priorState: eParseState = currState;
      let prePasmState: eParseState = currState;

      for (let i = 0; i < document.lineCount; i++) {
        let line = document.lineAt(i);
        const trimmedLine = line.text.trim();
        const trimmedNonCommentLine = this.parseUtils.getNonCommentLineRemainder(0, line.text);

        let linePrefix: string = line.text;
        let lineHasComment: boolean = false;
        let commentOffset: number = 0;
        let commentLength: number = 0;

        const sectionStatus = this._isSectionStartLine(line.text);
        if (sectionStatus.isSectionStart) {
          currState = sectionStatus.inProgressStatus;
        }

        if (line.text.length > 2) {
          const lineParts: string[] = linePrefix.split(/[ \t]/);
          linePrefix = lineParts.length > 0 ? lineParts[0].toUpperCase() : "";
          // the only form of comment we care about here is block comment after section name (e.g., "CON { text }")
          //  NEW and let's add the use of ' comment too
          const openBraceOffset: number = line.text.indexOf("{");
          const singleQuoteOffset: number = line.text.indexOf("'");
          if (openBraceOffset != -1) {
            commentOffset = openBraceOffset;
            const closeBraceOffset: number = line.text.indexOf("}", openBraceOffset + 1);
            if (closeBraceOffset != -1) {
              lineHasComment = true;
              commentLength = closeBraceOffset - openBraceOffset + 1;
            }
          } else if (singleQuoteOffset != -1) {
            commentOffset = singleQuoteOffset;
            lineHasComment = true;
            commentLength = line.text.length - singleQuoteOffset + 1;
          }
        }

        if (sectionStatus.isSectionStart) {
          if (linePrefix == "CON" || linePrefix == "DAT" || linePrefix == "VAR" || linePrefix == "OBJ") {
            // start CON/VAR/OBJ/DAT
            let sectionComment = lineHasComment ? line.text.substr(commentOffset, commentLength) : "";
            const blockSymbol = new vscode.DocumentSymbol(linePrefix + " " + sectionComment, "", vscode.SymbolKind.Field, line.range, line.range);
            this.setContainerSymbol(blockSymbol, symbols);
            //symbols.push(blockSymbol);
          } else if (linePrefix == "PUB" || linePrefix == "PRI") {
            // start PUB/PRI
            let methodScope: string = "Public";
            if (line.text.startsWith("PRI")) {
              methodScope = "Private";
            }
            let methodName: string = line.text.substr(3).trim();
            if (methodName.includes("'")) {
              const lineParts: string[] = methodName.split("'");
              methodName = lineParts[0].trim();
            }
            if (methodName.includes("{")) {
              const lineParts: string[] = methodName.split("{");
              methodName = lineParts[0].trim();
            }
            if (methodName.includes("|")) {
              const lineParts: string[] = methodName.split("|");
              methodName = lineParts[0].trim();
            }

            // NOTE this changed to METHOD when we added global labels which are to be Functions!
            const methodSymbol = new vscode.DocumentSymbol(linePrefix + " " + methodName, "", vscode.SymbolKind.Method, line.range, line.range);
            this.setContainerSymbol(methodSymbol, symbols);
            //symbols.push(methodSymbol);
          }
        } else {
          let global_label: string | undefined = undefined;
          if (trimmedNonCommentLine.length > 0) {
            //this._logMessage("  * [" + currState + "] ln:" + (i + 1) + " trimmedNonCommentLine=[" + trimmedNonCommentLine + "]");
            // NOT a section start
            if (currState == eParseState.inDatPasm) {
              // process pasm (assembly) lines
              if (trimmedLine.length > 0) {
                this._logMessage("    scan inDatPasm ln:" + (i + 1) + " trimmedNonCommentLine=[" + trimmedNonCommentLine + "]");
                const lineParts: string[] = trimmedNonCommentLine.split(/[ \t]/);
                if (lineParts.length > 0 && lineParts[0].toUpperCase() == "FIT") {
                  this._logMessage("  - (" + (i + 1) + "): pre-scan DAT PASM line trimmedLine=[" + trimmedLine + "]");
                  currState = prePasmState;
                  this._logMessage("    scan END DATPasm ln:" + (i + 1) + " POP currState=[" + currState + "]");
                  // and ignore rest of this line
                  continue;
                }
                // didn't leave this state check for new global label
                global_label = this._getDAT_PasmDeclaration(0, line.text); // let's get possible label on this ORG statement
              }
            } else if (currState == eParseState.inDat) {
              this._logMessage("    scan inDat ln:" + (i + 1) + " trimmedNonCommentLine=[" + trimmedNonCommentLine + "]");
              if (trimmedNonCommentLine.length > 6 && trimmedNonCommentLine.toUpperCase().includes("ORG")) {
                // ORG, ORGF, ORGH
                const nonStringLine: string = this.parseUtils.removeDoubleQuotedStrings(trimmedNonCommentLine);
                if (nonStringLine.toUpperCase().includes("ORG")) {
                  this._logMessage("  - pre-scan DAT line trimmedLine=[" + trimmedLine + "] now Dat PASM");
                  prePasmState = currState;
                  currState = eParseState.inDatPasm;
                  this._logMessage("    scan START DATPasm ln:" + (i + 1) + " PUSH currState=[" + prePasmState + "]");
                  // and ignore rest of this line
                  global_label = this._getDAT_PasmDeclaration(0, line.text); // let's get possible label on this ORG statement
                }
              } else {
                global_label = this._getDAT_Declaration(0, line.text);
              }
            }
            if (global_label != undefined) {
              // was Variable: sorta OK (image good, color bad)
              // was Constant: sorta OK (image good, color bad)   SAME
              const labelSymbol = new vscode.DocumentSymbol(global_label, "", vscode.SymbolKind.Constant, line.range, line.range);
              if (this.containerDocSymbol != undefined) {
                this.containerDocSymbol.children.push(labelSymbol);
              } else {
                symbols.push(labelSymbol);
              }
            }
          }
        }
      }
      // if we have one last unpushed, push it
      if (this.containerDocSymbol != undefined) {
        symbols.push(this.containerDocSymbol);
        this.containerDocSymbol = undefined;
      }
      resolve(symbols);
    });
  }

  private setContainerSymbol(newSymbol: vscode.DocumentSymbol, symbolSet: vscode.DocumentSymbol[]): void {
    if (this.containerDocSymbol != undefined) {
      symbolSet.push(this.containerDocSymbol);
    }
    this.containerDocSymbol = newSymbol;
  }

  private _logMessage(message: string): void {
    if (this.spin1OutlineLog != undefined) {
      //Write to output window.
      this.spin1OutlineLog.appendLine(message);
    }
  }

  private _isSectionStartLine(line: string): {
    isSectionStart: boolean;
    inProgressStatus: eParseState;
  } {
    // return T/F where T means our string starts a new section!
    let startStatus: boolean = false;
    let inProgressState: eParseState = eParseState.Unknown;
    if (line.length > 2) {
      const lineParts: string[] = line.split(/[ \t]/);
      if (lineParts.length > 0) {
        const sectionName: string = lineParts[0].toUpperCase();
        startStatus = true;
        if (sectionName === "CON") {
          inProgressState = eParseState.inCon;
        } else if (sectionName === "DAT") {
          inProgressState = eParseState.inDat;
        } else if (sectionName === "OBJ") {
          inProgressState = eParseState.inObj;
        } else if (sectionName === "PUB") {
          inProgressState = eParseState.inPub;
        } else if (sectionName === "PRI") {
          inProgressState = eParseState.inPri;
        } else if (sectionName === "VAR") {
          inProgressState = eParseState.inVar;
        } else {
          startStatus = false;
        }
      }
    }
    if (startStatus) {
      this._logMessage("** isSectStart line=[" + line + "]");
    }
    return {
      isSectionStart: startStatus,
      inProgressStatus: inProgressState,
    };
  }

  private _getDAT_Declaration(startingOffset: number, line: string): string | undefined {
    // HAVE    bGammaEnable        BYTE   TRUE               ' comment
    //         didShow             byte   FALSE[256]
    //                             byte   FALSE[256]
    let newGlobalLabel: string | undefined = undefined;
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    // get line parts - we only care about first one
    const dataDeclNonCommentStr = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
    let lineParts: string[] = this.parseUtils.getNonWhiteNParenLineParts(dataDeclNonCommentStr);
    //this._logMessage("- Oln GetDatDecl lineParts=[" + lineParts + "](" + lineParts.length + ")");
    let haveMoreThanDat: boolean = lineParts.length > 1 && lineParts[0].toUpperCase() == "DAT";
    if (haveMoreThanDat || lineParts[0].toUpperCase() != "DAT") {
      // remember this object name so we can annotate a call to it
      let nameIndex: number = 0;
      let typeIndex: number = 1;
      let maxParts: number = 2;
      if (lineParts[0].toUpperCase() == "DAT") {
        nameIndex = 1;
        typeIndex = 2;
        maxParts = 3;
      }
      let haveLabel: boolean = this.parseUtils.isDatOrPasmLabel(lineParts[nameIndex]);
      const isDataDeclarationLine: boolean = lineParts.length > maxParts - 1 && haveLabel && this.parseUtils.isDatStorageType(lineParts[typeIndex]) ? true : false;
      let lblFlag: string = haveLabel ? "T" : "F";
      let dataDeclFlag: string = isDataDeclarationLine ? "T" : "F";
      this._logMessage("- Oln GetDatDecl lineParts=[" + lineParts + "](" + lineParts.length + ") label=" + lblFlag + ", daDecl=" + dataDeclFlag);
      if (haveLabel) {
        let newName = lineParts[nameIndex];
        if (
          !newName.toLowerCase().startsWith("debug") &&
          !this.parseUtils.isPasmReservedWord(newName) &&
          !this.parseUtils.isSpinReservedWord(newName) &&
          !this.parseUtils.isSpinBuiltInVariable(newName) &&
          !this.parseUtils.isBuiltinReservedWord(newName)
        ) {
          if (!isDataDeclarationLine && !newName.startsWith(".") && !newName.startsWith(":") && !newName.includes("#")) {
            newGlobalLabel = newName;
            this._logMessage("  -- Oln GLBL gddcl newName=[" + newGlobalLabel + "]");
          }
        }
      }
    }
    return newGlobalLabel;
  }

  private _getDAT_PasmDeclaration(startingOffset: number, line: string): string | undefined {
    // HAVE    bGammaEnable        BYTE   TRUE               ' comment
    //         didShow             byte   FALSE[256]
    let newGlobalLabel: string | undefined = undefined;
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    // get line parts - we only care about first one
    const datPasmRHSStr = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
    const lineParts: string[] = this.parseUtils.getNonWhiteNParenLineParts(datPasmRHSStr);
    this._logMessage("- Oln GetPasmDatDecl lineParts=[" + lineParts + "](" + lineParts.length + ")");
    // handle name in 1 column
    let haveLabel: boolean = this.parseUtils.isDatOrPasmLabel(lineParts[0]);
    const isDataDeclarationLine: boolean = lineParts.length > 1 && haveLabel && this.parseUtils.isDatStorageType(lineParts[1]) ? true : false;
    if (haveLabel && !isDataDeclarationLine && !lineParts[0].startsWith(".") && !lineParts[0].startsWith(":") && !lineParts[0].includes("#")) {
      const labelName: string = lineParts[0];
      if (
        !this.parseUtils.isReservedPasmSymbols(labelName) &&
        !labelName.toUpperCase().startsWith("IF_") &&
        !labelName.toUpperCase().startsWith("_RET_") &&
        !labelName.toUpperCase().startsWith("DEBUG")
      ) {
        // org in first column is not label name, nor is if_ conditional
        newGlobalLabel = labelName;
        this._logMessage("  -- DAT Oln PASM GLBL newGlobalLabel=[" + newGlobalLabel + "]");
      }
    }
    return newGlobalLabel;
  }
}

// ----------------------------------------------------------------------------
//   Semantic Highlighting Provider
//
const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

/*
const enum TokenType {
    class, comment, enum, enumMember, event, function, interface, keyword, label, macro, method,
    namespace, number, operator, parameter, property, regexp, string, struct, type, typeParameter, variable, _
}

const enum TokenModifier {
    declaration, static, async, readonly, _
}
*/

export const Spin1Legend = (function () {
  const tokenTypesLegend = [
    "comment",
    "string",
    "keyword",
    "number",
    "regexp",
    "operator",
    "namespace",
    "type",
    "struct",
    "class",
    "interface",
    "enum",
    "typeParameter",
    "function",
    "method",
    "macro",
    "variable",
    "parameter",
    "property",
    "label",
    "enumMember",
    "event",
    "returnValue",
    "storageType",
    "colorName",
    "displayType",
    "displayName",
    "setupParameter",
    "feedParameter",
  ];
  tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

  const tokenModifiersLegend = [
    "declaration",
    "documentation",
    "readonly",
    "static",
    "abstract",
    "deprecated",
    "modification",
    "async",
    "definition",
    "defaultLibrary",
    "local",
    "instance",
    "missingDeclaration",
    "illegalUse",
  ];
  tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

  return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

interface IParsedToken {
  line: number;
  startCharacter: number;
  length: number;
  ptTokenType: string;
  ptTokenModifiers: string[];
}

interface IFilteredStrings {
  lineNoQuotes: string;
  lineParts: string[];
}

export class Spin1DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  private parseUtils = new ParseUtils();

  private spin1log: any = undefined;
  // adjust following true/false to show specific parsing debug
  private spin1DebugLogEnabled: boolean = true; // WARNING (REMOVE BEFORE FLIGHT)- change to 'false' - disable before commit
  private showSpinCode: boolean = true;
  private showPreProc: boolean = true;
  private showCON: boolean = true;
  private showOBJ: boolean = true;
  private showDAT: boolean = true;
  private showVAR: boolean = true;
  private showDEBUG: boolean = true;
  private showPasmCode: boolean = true;
  private showState: boolean = true;
  private logTokenDiscover: boolean = true;

  private semanticFindings: DocumentFindings;
  private conEnumInProgress: boolean = false;

  private configuration = semanticConfiguration;

  private currentMethodName: string = "";

  private bRecordTrailingComments: boolean = false; // initially, we don't generate tokens for trailing comments on lines

  public constructor() {
    if (this.spin1DebugLogEnabled) {
      if (this.spin1log === undefined) {
        //Create output channel
        this.spin1log = vscode.window.createOutputChannel("Spin1 Highlight DEBUG");
        this._logMessage("Spin1 log started.");
      } else {
        this._logMessage("\n\n------------------   NEW FILE ----------------\n\n");
      }
    }

    this.semanticFindings = new DocumentFindings(this.spin1DebugLogEnabled, this.spin1log);
  }

  public docFindings(): DocumentFindings {
    return this.semanticFindings;
  }

  public insertDocComment(document: vscode.TextDocument, selections: readonly vscode.Selection[]): vscode.ProviderResult<vscode.TextEdit[]> {
    return selections
      .map((selection) => {
        let results: vscode.ProviderResult<vscode.TextEdit[]> = [];
        let endOfLineStr: string = document.eol == EndOfLine.CRLF ? "\r\n" : "\n";
        this._logMessage(
          `* iDc selection(isSingle-[${selection.isSingleLine}] isEmpty-[${selection.isEmpty}] s,e-[${selection.start.line}:${selection.start.character} - ${selection.end.line}:${selection.end.character}] activ-[${selection.active.character}] anchor-[${selection.anchor.character}])`
        );
        const { firstLine, lastLine, lineCount } = this._lineNumbersFromSelection(document, selection);
        const cursorPos: vscode.Position = new vscode.Position(firstLine + 1, 0);
        let linesToInsert: string[] = [];
        let currLine: string = document.lineAt(firstLine).text.trim();
        const linePrefix = currLine.length > 3 ? currLine.substring(0, 3).toLowerCase() : "";
        const isSignature: boolean = linePrefix.startsWith("pub") || linePrefix.startsWith("pri");
        const isPRI: boolean = linePrefix.startsWith("pri");
        if (isSignature) {
          const commentPrefix = isPRI ? "'" : "''";
          linesToInsert.push(commentPrefix + " ..." + endOfLineStr); // for description
          linesToInsert.push(commentPrefix + " " + endOfLineStr); // blank line
          const posOpenParen = currLine.indexOf("(");
          const posCloseParen = currLine.indexOf(")");
          if (posOpenParen != -1 && posCloseParen != -1) {
            const bHasParameters: boolean = posCloseParen - posOpenParen > 1 ? true : false;
            if (bHasParameters) {
              const paramString: string = currLine.substring(posOpenParen + 1, posCloseParen);
              const numberParameters: number = (paramString.match(/,/g) || []).length + 1;
              const paramNames = paramString.split(/[ \t,]/).filter(Boolean);
              this._logMessage(`* iDc paramString=[${paramString}], paramNames=[${paramNames}]`);
              for (let paramIdx = 0; paramIdx < numberParameters; paramIdx++) {
                linesToInsert.push(commentPrefix + ` @param ${paramNames[paramIdx]} - ` + endOfLineStr); // blank line
              }
            }
            const bHasReturnValues: boolean = currLine.includes(":") ? true : false;
            const bHasLocalVariables: boolean = currLine.includes("|") ? true : false;
            if (bHasReturnValues) {
              const posStartReturn = currLine.indexOf(":") + 1;
              const posEndReturn = bHasLocalVariables ? currLine.indexOf("|") - 1 : currLine.length;
              const returnsString: string = currLine.substring(posStartReturn, posEndReturn);
              const numberReturns: number = (returnsString.match(/,/g) || []).length + 1;
              const returnNames = returnsString.split(/[ \t,]/).filter(Boolean);
              this._logMessage(`* iDc returnsString=[${returnsString}], returnNames=[${returnNames}]`);
              for (let retValIdx = 0; retValIdx < numberReturns; retValIdx++) {
                linesToInsert.push(commentPrefix + ` @returns ${returnNames[retValIdx]} - ` + endOfLineStr); // blank line
              }
            }
            let posTrailingComment = currLine.indexOf("'");
            if (posTrailingComment == -1) {
              posTrailingComment = currLine.indexOf("{");
            }
            if (bHasLocalVariables) {
              // locals are always non-doc single-line comments
              const posStartLocal = currLine.indexOf("|") + 1;
              const posEndLocal = posTrailingComment != -1 ? posTrailingComment : currLine.length;
              const localsString: string = currLine.substring(posStartLocal, posEndLocal);
              const numberLocals: number = (localsString.match(/,/g) || []).length + 1;
              const localsNames = localsString.split(/[ \t,]/).filter(Boolean);
              this._logMessage(`* iDc localsString=[${localsString}], localsNames=[${localsNames}]`);
              linesToInsert.push("" + endOfLineStr); // empty line so following is not shown in comments for method
              linesToInsert.push("' Local Variables:" + endOfLineStr); // blank line
              for (let localIdx = 0; localIdx < numberLocals; localIdx++) {
                linesToInsert.push("'" + ` @local ${localsNames[localIdx]} - ` + endOfLineStr); // blank line
              }
            }
          }
        } else {
          this._logMessage(`* iDc SKIP - NOT on signature line`);
        }

        // insert the lines, if any
        if (linesToInsert.length > 0) {
          for (let line of linesToInsert) {
            results.push(vscode.TextEdit.insert(cursorPos, `${line}`));
          }
        }
        return results;
      })
      .reduce((selections, selection) => selections.concat(selection), []);
  }

  async provideDocumentSemanticTokens(document: vscode.TextDocument, cancelToken: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
    // SEE https://www.codota.com/code/javascript/functions/vscode/CancellationToken/isCancellationRequested
    if (cancelToken) {
    } // silence our compiler for now... TODO: we should adjust loop so it can break on cancelToken.isCancellationRequested
    this._resetForNewDocument();
    this._logMessage("* Config: spinExtensionBehavior.highlightFlexspinDirectives: [" + this.configuration.highlightFlexspin + "]");

    const allTokens = this._parseText(document.getText());
    const builder = new vscode.SemanticTokensBuilder();
    allTokens.forEach((token) => {
      builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.ptTokenType), this._encodeTokenModifiers(token.ptTokenModifiers));
    });
    return builder.build();
  }

  private _lineNumbersFromSelection(document: vscode.TextDocument, selection: vscode.Selection): { firstLine: number; lastLine: number; lineCount: number } {
    let lineCount: number = 0;
    let firstLine: number = 0;
    let lastLine: number = 0;
    // what kind of section do we have?
    if (selection.isEmpty) {
      // empty, just a cursor location
      firstLine = selection.start.line;
      lastLine = selection.end.line;
      lineCount = lastLine - firstLine + 1;
    } else {
      // non-empty then let's figure out which lines could change
      const allSelectedText: string = document.getText(selection);
      const lines: string[] = allSelectedText.split(/\r?\n/);
      lineCount = lines.length;
      firstLine = selection.start.line;
      lastLine = selection.end.line;
      //this._logMessage(` - (DBG) ${lineCount} lines: fm,to=[${firstLine}, ${lastLine}], allSelectedText=[${allSelectedText}](${allSelectedText.length}), lines=[${lines}](${lines.length})`);
      for (var currLineIdx: number = 0; currLineIdx < lines.length; currLineIdx++) {
        if (lines[currLineIdx].length == 0) {
          if (currLineIdx == lines.length - 1) {
            lastLine--;
            lineCount--;
          }
        }
      }
      if (firstLine > lastLine && lineCount == 0) {
        // have odd selection case, let's override it!
        // (selection contained just a newline!)
        firstLine--;
        lastLine = firstLine;
        lineCount = 1;
      }
    }

    return { firstLine, lastLine, lineCount };
  }

  private _encodeTokenType(tokenType: string): number {
    if (tokenTypes.has(tokenType)) {
      return tokenTypes.get(tokenType)!;
    } else if (tokenType === "notInLegend") {
      return tokenTypes.size + 2;
    }
    return 0;
  }

  private _resetForNewDocument(): void {
    this.semanticFindings.clear();
    this.conEnumInProgress = false;
    this.currentMethodName = "";
    if (reloadSemanticConfiguration()) {
      this.configuration = semanticConfiguration;
    }
  }

  private _encodeTokenModifiers(strTokenModifiers: string[]): number {
    let result = 0;
    for (let i = 0; i < strTokenModifiers.length; i++) {
      const tokenModifier = strTokenModifiers[i];
      if (tokenModifiers.has(tokenModifier)) {
        result = result | (1 << tokenModifiers.get(tokenModifier)!);
      } else if (tokenModifier === "notInLegend") {
        result = result | (1 << (tokenModifiers.size + 2));
      }
    }
    return result;
  }

  // track comment preceding declaration line
  private priorSingleLineComment: string | undefined = undefined;
  private rightEdgeComment: string | undefined = undefined;

  private _declarationComment(): string | undefined {
    // return the most appropriate comment for declaration
    const desiredComment: string | undefined = this.priorSingleLineComment ? this.priorSingleLineComment : this.rightEdgeComment;
    // and clear them out since we used them
    this.priorSingleLineComment = undefined;
    this.rightEdgeComment = undefined;
    return desiredComment;
  }

  private _parseText(text: string): IParsedToken[] {
    // parse our entire file
    const lines = text.split(/\r\n|\r|\n/);
    let currState: eParseState = eParseState.inCon; // compiler defaults to CON at start
    let priorState: eParseState = currState;
    let prePasmState: eParseState = currState;

    // track block comments
    let currBlockComment: RememberedComment | undefined = undefined;
    let currSingleLineBlockComment: RememberedComment | undefined = undefined;

    const tokenSet: IParsedToken[] = [];

    // ==============================================================================
    // prepass to find PRI/PUB method, OBJ names, and VAR/DAT names
    //

    // -------------------- PRE-PARSE just locating symbol names --------------------
    // also track and record block comments (both braces and tic's!)
    // let's also track prior single line and trailing comment on same line
    this._logMessage("---> Pre SCAN");
    let bBuildingSingleLineCmtBlock: boolean = false;
    let bBuildingSingleLineDocCmtBlock: boolean = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const trimmedNonCommentLine = this.parseUtils.getNonCommentLineRemainder(0, line);
      const offSet: number = trimmedNonCommentLine.length > 0 ? line.indexOf(trimmedNonCommentLine) + 1 : line.indexOf(trimmedLine) + 1;
      const tempComment = line.substring(trimmedNonCommentLine.length + offSet).trim();
      this.rightEdgeComment = tempComment.length > 0 ? tempComment : undefined;
      const sectionStatus = this._isSectionStartLine(line);
      const lineParts: string[] = trimmedNonCommentLine.split(/[ \t]/);

      // special blocks of doc-comment and non-doc comment lines handling
      if (bBuildingSingleLineDocCmtBlock && !trimmedLine.startsWith("''")) {
        // process single line doc-comment
        bBuildingSingleLineDocCmtBlock = false;
        // add record single line comment block if > 1 line and clear
        if (currSingleLineBlockComment) {
          currSingleLineBlockComment.closeAsSingleLineBlock(i - 1);
          // NOTE: single line doc comments can be 1 line long!!! (unlike single line non-doc comments)
          this._logMessage("---> Pre SCAN: found comment " + currSingleLineBlockComment.spanString());
          this.semanticFindings.recordComment(currSingleLineBlockComment);
          currSingleLineBlockComment = undefined;
        }
      } else if (bBuildingSingleLineCmtBlock && !trimmedLine.startsWith("'")) {
        // process single line non-doc comment
        bBuildingSingleLineCmtBlock = false;
        // add record single line comment block if > 1 line and clear
        if (currSingleLineBlockComment) {
          // NOTE: single line non-doc comments must be 2 or more lines long!!! (unlike single line doc comments)
          if (currSingleLineBlockComment.lineCount > 1) {
            currSingleLineBlockComment.closeAsSingleLineBlock(i - 1);
            this._logMessage("---> Pre SCAN: found comment " + currSingleLineBlockComment.spanString());
            this.semanticFindings.recordComment(currSingleLineBlockComment);
          }
          currSingleLineBlockComment = undefined;
        }
      }

      // now start our processing
      if (currState == eParseState.inMultiLineComment) {
        // in multi-line non-doc-comment, hunt for end '}' to exit
        // ALLOW {...} on same line without closing!
        let nestedOpeningOffset: number = -1;
        let closingOffset: number = -1;
        let currOffset: number = 0;
        let bFoundOpenClosePair: boolean = false;
        do {
          nestedOpeningOffset = trimmedLine.indexOf("{", currOffset);
          if (nestedOpeningOffset != -1) {
            bFoundOpenClosePair = false;
            // we have an opening {
            closingOffset = trimmedLine.indexOf("}", nestedOpeningOffset);
            if (closingOffset != -1) {
              // and we have a closing, ignore this see if we have next
              currOffset = closingOffset + 1;
              bFoundOpenClosePair = true;
            } else {
              currOffset = nestedOpeningOffset + 1;
            }
          }
        } while (nestedOpeningOffset != -1 && bFoundOpenClosePair);
        closingOffset = trimmedLine.indexOf("}", currOffset);
        if (closingOffset != -1) {
          // have close, comment ended
          // end the comment recording
          currBlockComment?.appendLastLine(i, line);
          // record new comment
          if (currBlockComment) {
            this.semanticFindings.recordComment(currBlockComment);
            this._logMessage("---> Pre SCAN: found comment " + currBlockComment.spanString());
            currBlockComment = undefined;
          }
          currState = priorState;
        }
        //  DO NOTHING Let Syntax highlighting do this
        continue;
      } else if (currState == eParseState.inMultiLineDocComment) {
        // in multi-line doc-comment, hunt for end '}}' to exit
        let closingOffset = line.indexOf("}}");
        if (closingOffset != -1) {
          // have close, comment ended
          // end the comment recording
          currBlockComment?.appendLastLine(i, line);
          // record new comment
          if (currBlockComment) {
            this.semanticFindings.recordComment(currBlockComment);
            this._logMessage("---> Pre SCAN: found comment " + currBlockComment.spanString());
            currBlockComment = undefined;
          }
          currState = priorState;
        }
        //  DO NOTHING Let Syntax highlighting do this
        continue;
      } else if (trimmedLine.length == 0) {
        // a blank line clears pending single line comments
        this.priorSingleLineComment = undefined;
        continue;
      } else if (this.parseUtils.isFlexspinPreprocessorDirective(lineParts[0])) {
        this._getPreProcessor_Declaration(0, i + 1, line);
        // a FlexspinPreprocessorDirective line clears pending single line comments
        this.priorSingleLineComment = undefined;
        continue;
      } else if (trimmedLine.startsWith("{{")) {
        // process multi-line doc comment
        let openingOffset = line.indexOf("{{");
        const closingOffset = line.indexOf("}}", openingOffset + 2);
        if (closingOffset != -1) {
          // is single line comment, just ignore it Let Syntax highlighting do this
          // record new single-line comment
          let oneLineComment = new RememberedComment(eCommentType.multiLineDocComment, i, line);
          oneLineComment.closeAsSingleLine();
          if (!oneLineComment.isBlankLine) {
            this.semanticFindings.recordComment(oneLineComment);
            this._logMessage("---> Pre SCAN: found comment " + oneLineComment.spanString());
          }
          currBlockComment = undefined; // just making sure...
        } else {
          // is open of multiline comment
          priorState = currState;
          currState = eParseState.inMultiLineDocComment;
          // start  NEW comment
          currBlockComment = new RememberedComment(eCommentType.multiLineDocComment, i, line);
          //  DO NOTHING Let Syntax highlighting do this
        }
        continue;
      } else if (trimmedLine.startsWith("{")) {
        // process possible multi-line non-doc comment
        // do we have a close on this same line?
        let openingOffset = line.indexOf("{");
        const closingOffset = line.indexOf("}", openingOffset + 1);
        if (closingOffset != -1) {
          // is single line comment...
        } else {
          // is open of multiline comment
          priorState = currState;
          currState = eParseState.inMultiLineComment;
          // start  NEW comment
          currBlockComment = new RememberedComment(eCommentType.multiLineComment, i, line);
          //  DO NOTHING Let Syntax highlighting do this
        }
        continue;
      } else if (bBuildingSingleLineDocCmtBlock && trimmedLine.startsWith("''")) {
        // process single line doc comment which follows one of same
        // we no longer have a prior single line comment
        this.priorSingleLineComment = undefined;
        // add to existing single line doc-comment block
        currSingleLineBlockComment?.appendLine(line);
        continue;
      } else if (bBuildingSingleLineCmtBlock && trimmedLine.startsWith("'")) {
        // process single line non-doc comment which follows one of same
        // we no longer have a prior single line comment
        this.priorSingleLineComment = undefined;
        // add to existing single line non-doc-comment block
        currSingleLineBlockComment?.appendLine(line);
        continue;
      } else if (trimmedLine.startsWith("''")) {
        // process single line doc comment
        this.priorSingleLineComment = trimmedLine; // record this line
        // create new single line doc-comment block
        bBuildingSingleLineDocCmtBlock = true;
        currSingleLineBlockComment = new RememberedComment(eCommentType.singleLineDocComment, i, line);
        continue;
      } else if (trimmedLine.startsWith("'")) {
        // process single line non-doc comment
        this.priorSingleLineComment = trimmedLine; // record this line
        // create new single line non-doc-comment block
        bBuildingSingleLineCmtBlock = true;
        currSingleLineBlockComment = new RememberedComment(eCommentType.singleLineComment, i, line);
        continue;
      } else if (sectionStatus.isSectionStart) {
        currState = sectionStatus.inProgressStatus;
        this._logState("- scan ln:" + (i + 1) + " currState=[" + currState + "]");
        // ID the remainder of the line
        if (currState == eParseState.inPub || currState == eParseState.inPri) {
          // process PUB/PRI method signature
          if (trimmedNonCommentLine.length > 3) {
            this._getPUB_PRI_Name(3, i + 1, line);
          }
        } else if (currState == eParseState.inCon) {
          // process a constant line
          if (trimmedNonCommentLine.length > 3) {
            this._getCON_Declaration(3, i + 1, line);
          }
        } else if (currState == eParseState.inDat) {
          // process a class(static) variable line
          if (trimmedNonCommentLine.length > 6 && trimmedNonCommentLine.toUpperCase().includes("ORG")) {
            // ORG, ORGF, ORGH
            const nonStringLine: string = this.parseUtils.removeDoubleQuotedStrings(trimmedNonCommentLine);
            if (nonStringLine.toUpperCase().includes("ORG")) {
              this._logPASM("- (" + (i + 1) + "): pre-scan DAT line trimmedLine=[" + trimmedLine + "] now Dat PASM");
              prePasmState = currState;
              currState = eParseState.inDatPasm;
              this._getDAT_Declaration(0, i + 1, line); // let's get possible label on this ORG statement
              continue;
            }
          }
          this._getDAT_Declaration(0, i + 1, line);
        } else if (currState == eParseState.inObj) {
          // process an object line
          if (trimmedNonCommentLine.length > 3) {
            this._getOBJ_Declaration(3, i + 1, line);
          }
        } else if (currState == eParseState.inVar) {
          // process a instance-variable line
          if (trimmedNonCommentLine.length > 3) {
            this._getVAR_Declaration(3, i + 1, line);
          }
        }
        // we processed the block declaration line, now wipe out prior comment
        this.priorSingleLineComment = undefined; // clear it out...
        continue;
      } else if (currState == eParseState.inCon) {
        // process a constant line
        if (trimmedLine.length > 0) {
          this._getCON_Declaration(0, i + 1, line);
        }
      } else if (currState == eParseState.inDat) {
        // process a data line
        if (trimmedLine.length > 0) {
          if (trimmedLine.length > 6) {
            if (trimmedLine.toUpperCase().includes("ORG")) {
              // ORG, ORGF, ORGH
              const nonStringLine: string = this.parseUtils.removeDoubleQuotedStrings(trimmedLine);
              if (nonStringLine.toUpperCase().includes("ORG")) {
                this._logPASM("- (" + (i + 1) + "): pre-scan DAT line trimmedLine=[" + trimmedLine + "] now Dat PASM");
                prePasmState = currState;
                currState = eParseState.inDatPasm;
                this._getDAT_Declaration(0, i + 1, line); // let's get possible label on this ORG statement
                continue;
              }
            }
          }
          this._getDAT_Declaration(0, i + 1, line);
        }
      } else if (currState == eParseState.inVar) {
        // process a variable declaration line
        if (trimmedLine.length > 0) {
          this._getVAR_Declaration(0, i + 1, line);
        }
      } else if (currState == eParseState.inObj) {
        // process an object declaration line
        if (trimmedLine.length > 0) {
          this._getOBJ_Declaration(0, i + 1, line);
        }
      } else if (currState == eParseState.inDatPasm) {
        // process pasm (assembly) lines
        if (trimmedLine.length > 0) {
          const lineParts: string[] = trimmedLine.split(/[ \t]/);
          if (lineParts.length > 0 && lineParts[0].toUpperCase() == "FIT") {
            this._logPASM("- (" + (i + 1) + "): pre-scan DAT PASM line trimmedLine=[" + trimmedLine + "]");
            currState = prePasmState;
            this._logState("- scan ln:" + (i + 1) + " POP currState=[" + currState + "]");
            // and ignore rest of this line
          } else {
            this._getDAT_PasmDeclaration(0, i + 1, line);
          }
        }
      } else if (currState == eParseState.inPub || currState == eParseState.inPri) {
        // scan SPIN2 line for object constant or method() uses
        this._getSpinObjectConstantMethodDeclaration(0, i + 1, line);
      }
    }
    // --------------------         End of PRE-PARSE             --------------------
    this._logMessage("---> Actual SCAN");

    this.bRecordTrailingComments = true; // from here forward generate tokens for trailing comments on lines

    //
    // Final PASS to identify all name references
    //
    currState = eParseState.inCon; // reset for 2nd pass - compiler defaults to CON at start
    priorState = currState; // reset for 2nd pass
    prePasmState = currState; // same

    // for each line do...
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const sectionStatus = this._isSectionStartLine(line);
      const lineParts: string[] = trimmedLine.split(/[ \t]/);
      // TODO: UNDONE add filter which corrects for syntax inability to mark 'comments when more than one "'" present on line!
      //if (trimmedLine.length > 2 && trimmedLine.includes("'")) {
      //    const partialTokenSet: IParsedToken[] = this._possiblyMarkBrokenSingleLineComment(i, 0, line);
      //    partialTokenSet.forEach(newToken => {
      //        tokenSet.push(newToken);
      //    });
      //}
      if (currState == eParseState.inMultiLineComment) {
        // in multi-line non-doc-comment, hunt for end '}' to exit
        // ALLOW {...} on same line without closing!
        this._logMessage("    hunt for '}' ln:" + (i + 1) + " trimmedLine=[" + trimmedLine + "]");
        let nestedOpeningOffset: number = -1;
        let closingOffset: number = -1;
        let currOffset: number = 0;
        let bFoundOpenClosePair: boolean = false;
        let bFoundNestedOpen: boolean = false;
        do {
          nestedOpeningOffset = trimmedLine.indexOf("{", currOffset);
          if (nestedOpeningOffset != -1) {
            bFoundOpenClosePair = false;
            bFoundNestedOpen = true;
            // we have an opening {
            closingOffset = trimmedLine.indexOf("}", nestedOpeningOffset);
            if (closingOffset != -1) {
              // and we have a closing, ignore this see if we have next
              currOffset = closingOffset + 1;
              bFoundOpenClosePair = true;
              this._logMessage("    skip {...} ln:" + (i + 1) + " nestedOpeningOffset=(" + nestedOpeningOffset + "), closingOffset=(" + closingOffset + ")");
            } else {
              currOffset = nestedOpeningOffset + 1;
            }
          }
        } while (nestedOpeningOffset != -1 && bFoundOpenClosePair);
        closingOffset = trimmedLine.indexOf("}", currOffset);
        if (closingOffset != -1) {
          // have close, comment ended
          this._logMessage("    FOUND '}' ln:" + (i + 1) + " trimmedLine=[" + trimmedLine + "]");
          currState = priorState;
        }
        continue;
      } else if (currState == eParseState.inMultiLineDocComment) {
        // in multi-line doc-comment, hunt for end '}}' to exit
        let closingOffset = line.indexOf("}}");
        if (closingOffset != -1) {
          // have close, comment ended
          currState = priorState;
        }
        //  DO NOTHING Let Syntax highlighting do this
      } else if (this.parseUtils.isFlexspinPreprocessorDirective(lineParts[0])) {
        const partialTokenSet: IParsedToken[] = this._reportPreProcessorLine(i, 0, line);
        partialTokenSet.forEach((newToken) => {
          this._logPreProc("=> PreProc: " + this._tokenString(newToken, line));
          tokenSet.push(newToken);
        });
        continue;
      } else if (sectionStatus.isSectionStart) {
        currState = sectionStatus.inProgressStatus;
        this._logState("  -- ln:" + (i + 1) + " currState=[" + currState + "]");
        // ID the section name
        // DON'T mark the section literal, Syntax highlighting does this well!

        // ID the remainder of the line
        if (currState == eParseState.inPub || currState == eParseState.inPri) {
          // process method signature
          if (line.length > 3) {
            const partialTokenSet: IParsedToken[] = this._reportPUB_PRI_Signature(i, 3, line);
            partialTokenSet.forEach((newToken) => {
              tokenSet.push(newToken);
            });
          }
        } else if (currState == eParseState.inCon) {
          this.conEnumInProgress = false; // so we can tell in CON processor when to allow isolated names
          // process a possible constant use on the CON line itself!
          if (line.length > 3) {
            const partialTokenSet: IParsedToken[] = this._reportCON_DeclarationLine(i, 3, line);
            partialTokenSet.forEach((newToken) => {
              this._logCON("=> CON: " + this._tokenString(newToken, line));
              tokenSet.push(newToken);
            });
          }
        } else if (currState == eParseState.inDat) {
          // process a possible constant use on the CON line itself!
          if (line.length > 3) {
            if (trimmedLine.length > 6) {
              const nonCommentLineRemainder: string = this.parseUtils.getNonCommentLineRemainder(0, trimmedLine);
              let orgStr: string = "ORGH";
              let orgOffset: number = nonCommentLineRemainder.toUpperCase().indexOf(orgStr); // ORGH
              if (orgOffset == -1) {
                orgStr = "ORGF";
                orgOffset = nonCommentLineRemainder.toUpperCase().indexOf(orgStr); // ORGF
                if (orgOffset == -1) {
                  orgStr = "ORG";
                  orgOffset = nonCommentLineRemainder.toUpperCase().indexOf(orgStr); // ORG
                }
              }
              if (orgOffset != -1) {
                // let's double check this is NOT in quoted string
                const nonStringLine: string = this.parseUtils.removeDoubleQuotedStrings(nonCommentLineRemainder);
                orgOffset = nonStringLine.toUpperCase().indexOf(orgStr); // ORG, ORGF, ORGH
              }
              if (orgOffset != -1) {
                this._logPASM("- (" + (i + 1) + "): scan DAT line nonCommentLineRemainder=[" + nonCommentLineRemainder + "]");

                // process remainder of ORG line
                const nonCommentOffset = line.indexOf(nonCommentLineRemainder, 0);
                // lineNumber, currentOffset, line, allowLocalVarStatus, this.showPasmCode
                const allowLocalVarStatus: boolean = false;
                const NOT_DAT_PASM: boolean = false;
                const partialTokenSet: IParsedToken[] = this._reportDAT_ValueDeclarationCode(i, nonCommentOffset + orgOffset + orgStr.length, line, allowLocalVarStatus, this.showDAT, NOT_DAT_PASM);
                partialTokenSet.forEach((newToken) => {
                  tokenSet.push(newToken);
                });

                prePasmState = currState;
                currState = eParseState.inDatPasm;
                // and ignore rest of this line
                continue;
              }
            }
            const partialTokenSet: IParsedToken[] = this._reportDAT_DeclarationLine(i, 3, line);
            partialTokenSet.forEach((newToken) => {
              tokenSet.push(newToken);
            });
          }
        } else if (currState == eParseState.inObj) {
          // process a possible constant use on the CON line itself!
          if (line.length > 3) {
            const partialTokenSet: IParsedToken[] = this._reportOBJ_DeclarationLine(i, 3, line);
            partialTokenSet.forEach((newToken) => {
              this._logOBJ("=> OBJ: " + this._tokenString(newToken, line));
              tokenSet.push(newToken);
            });
          }
        } else if (currState == eParseState.inVar) {
          // process a possible constant use on the CON line itself!
          if (line.length > 3) {
            const partialTokenSet: IParsedToken[] = this._reportVAR_DeclarationLine(i, 3, line);
            partialTokenSet.forEach((newToken) => {
              tokenSet.push(newToken);
            });
          }
        }
      } else if (trimmedLine.startsWith("''")) {
        // process single line doc comment
        //  DO NOTHING Let Syntax highlighting do this
      } else if (trimmedLine.startsWith("'")) {
        // process single line non-doc comment
        //  DO NOTHING Let Syntax highlighting do this
      } else if (trimmedLine.startsWith("{{")) {
        // process multi-line doc comment
        let openingOffset = line.indexOf("{{");
        const closingOffset = line.indexOf("}}", openingOffset + 2);
        if (closingOffset != -1) {
          // is single line comment, just ignore it Let Syntax highlighting do this
        } else {
          // is open of multiline comment
          priorState = currState;
          currState = eParseState.inMultiLineDocComment;
          //  DO NOTHING Let Syntax highlighting do this
        }
      } else if (trimmedLine.startsWith("{")) {
        // process possible multi-line non-doc comment
        // do we have a close on this same line?
        let openingOffset = line.indexOf("{");
        const closingOffset = line.indexOf("}", openingOffset + 1);
        if (closingOffset != -1) {
          // is single line comment, just ignore it Let Syntax highlighting do this
        } else {
          // is open of multiline comment
          priorState = currState;
          currState = eParseState.inMultiLineComment;
          //  DO NOTHING Let Syntax highlighting do this
        }
      } else if (currState == eParseState.inCon) {
        // process a line in a constant section
        if (trimmedLine.length > 0) {
          this._logCON("- process CON line(" + (i + 1) + "):  trimmedLine=[" + trimmedLine + "]");
          const partialTokenSet: IParsedToken[] = this._reportCON_DeclarationLine(i, 0, line);
          partialTokenSet.forEach((newToken) => {
            this._logCON("=> CON: " + this._tokenString(newToken, line));
            tokenSet.push(newToken);
          });
        }
      } else if (currState == eParseState.inDat) {
        // process a line in a data section
        if (trimmedLine.length > 0) {
          this._logDAT("- process DAT line(" + (i + 1) + "): trimmedLine=[" + trimmedLine + "]");
          const nonCommentLineRemainder: string = this.parseUtils.getNonCommentLineRemainder(0, trimmedLine);
          let orgStr: string = "ORGH";
          let orgOffset: number = nonCommentLineRemainder.toUpperCase().indexOf(orgStr); // ORGH
          if (orgOffset == -1) {
            orgStr = "ORGF";
            orgOffset = nonCommentLineRemainder.toUpperCase().indexOf(orgStr); // ORGF
            if (orgOffset == -1) {
              orgStr = "ORG";
              orgOffset = nonCommentLineRemainder.toUpperCase().indexOf(orgStr); // ORG
            }
          }
          if (orgOffset != -1) {
            // let's double check this is NOT in quoted string
            const nonStringLine: string = this.parseUtils.removeDoubleQuotedStrings(nonCommentLineRemainder);
            orgOffset = nonStringLine.toUpperCase().indexOf(orgStr); // ORG, ORGF, ORGH
          }
          if (orgOffset != -1) {
            // process ORG line allowing label to be present
            const partialTokenSet: IParsedToken[] = this._reportDAT_DeclarationLine(i, 0, line);
            partialTokenSet.forEach((newToken) => {
              this._logOBJ("=> ORG: " + this._tokenString(newToken, line));
              tokenSet.push(newToken);
            });

            prePasmState = currState;
            currState = eParseState.inDatPasm;
            // and ignore rest of this line
          } else {
            const partialTokenSet: IParsedToken[] = this._reportDAT_DeclarationLine(i, 0, line);
            partialTokenSet.forEach((newToken) => {
              this._logDAT("=> DAT: " + this._tokenString(newToken, line));
              tokenSet.push(newToken);
            });
          }
        }
      } else if (currState == eParseState.inVar) {
        // process a line in a variable data section
        if (trimmedLine.length > 0) {
          this._logVAR("- process VAR line(" + (i + 1) + "):  trimmedLine=[" + trimmedLine + "]");
          const partialTokenSet: IParsedToken[] = this._reportVAR_DeclarationLine(i, 0, line);
          partialTokenSet.forEach((newToken) => {
            this._logVAR("=> VAR: " + this._tokenString(newToken, line));
            tokenSet.push(newToken);
          });
        }
      } else if (currState == eParseState.inObj) {
        // process a line in an object section
        if (trimmedLine.length > 0) {
          this._logOBJ("- process OBJ line(" + (i + 1) + "):  trimmedLine=[" + trimmedLine + "]");
          const partialTokenSet: IParsedToken[] = this._reportOBJ_DeclarationLine(i, 0, line);
          partialTokenSet.forEach((newToken) => {
            this._logOBJ("=> OBJ: " + this._tokenString(newToken, line));
            tokenSet.push(newToken);
          });
        }
      } else if (currState == eParseState.inDatPasm) {
        // process DAT section pasm (assembly) lines
        if (trimmedLine.length > 0) {
          this._logPASM("- process DAT PASM line(" + (i + 1) + "):  trimmedLine=[" + trimmedLine + "]");
          // in DAT sections we end with FIT or just next section
          const partialTokenSet: IParsedToken[] = this._reportDAT_PasmCode(i, 0, line);
          partialTokenSet.forEach((newToken) => {
            this._logPASM("=> DAT: " + this._tokenString(newToken, line));
            tokenSet.push(newToken);
          });
          const lineParts: string[] = trimmedLine.split(/[ \t]/);
          if (lineParts.length > 0 && lineParts[0].toUpperCase() == "FIT") {
            currState = prePasmState;
            this._logState("- scan ln:" + (i + 1) + " POP currState=[" + currState + "]");
            // and ignore rest of this line
          }
        }
      } else if (currState == eParseState.inPub || currState == eParseState.inPri) {
        // process a method def'n line
        if (trimmedLine.length > 0) {
          this._logSPIN("- process SPIN2 line(" + (i + 1) + "): trimmedLine=[" + trimmedLine + "]");
          const lineParts: string[] = trimmedLine.split(/[ \t]/);
          const partialTokenSet: IParsedToken[] = this._reportSPIN_Code(i, 0, line);
          partialTokenSet.forEach((newToken) => {
            this._logSPIN("=> SPIN: " + this._tokenString(newToken, line));
            tokenSet.push(newToken);
          });
        }
      }
    }
    this._checkTokenSet(tokenSet);
    return tokenSet;
  }

  private _getSpinObjectConstantMethodDeclaration(startingOffset: number, lineNbr: number, line: string): void {
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    let remainingNonCommentLineStr: string = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
    //this._logOBJ('- RptObjDecl remainingNonCommentLineStr=[' + remainingNonCommentLineStr + ']');
    const bHasDotRefs: boolean = remainingNonCommentLineStr.includes(".");
    if (bHasDotRefs) {
      // if we have whitespace before paren then remove it
      if (remainingNonCommentLineStr.includes(" (")) {
        remainingNonCommentLineStr = remainingNonCommentLineStr.replace(" (", "(");
      }
      // get line parts - we only care about first one
      const lineParts: string[] = remainingNonCommentLineStr.split(/[ \t=]/).filter(Boolean);
      this._logSPIN("  - ln:" + lineNbr + " GetSpinObjConstMethDecl lineParts=[" + lineParts + "](" + lineParts.length + ")");
      for (let partIdx = 0; partIdx < lineParts.length; partIdx++) {
        const possObjRef = lineParts[partIdx];
        if (possObjRef.includes(".")) {
          const bISMethod: boolean = true; // FIXME: DO BETTER!  -> SPIN1 force all to methods for now possObjRef.includes("(");
          const nameParts: string[] = possObjRef.split(/[\.\(]/).filter(Boolean);
          if (nameParts.length > 1) {
            const objName: string = nameParts[0];
            const objRef: string = nameParts[1];
            if (objName.charAt(0).match(/[a-zA-Z_]/) && objRef.charAt(0).match(/[a-zA-Z_]/)) {
              this._logSPIN("  ---  nameParts=[" + nameParts + "](" + nameParts.length + ")");
              //this._logOBJ("  -- GLBL GetOBJDecl newName=[" + nameParts[0] + "]");
              // remember this object name so we can annotate a call to it
              this._logSPIN("  --- objName=[" + objName + "], objRef=[" + objRef + "]");
              if (bISMethod) {
                this.semanticFindings.setGlobalToken(objRef, new RememberedToken("method", []), lineNbr, this._declarationComment(), objName);
              } else {
                this.semanticFindings.setGlobalToken(objRef, new RememberedToken("variable", ["readonly"]), lineNbr, this._declarationComment(), objName);
              }
            }
          }
        }
      }
    }
  }

  private _getPreProcessor_Declaration(startingOffset: number, lineNbr: number, line: string): void {
    if (this.configuration.highlightFlexspin) {
      let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
      const nonCommentConstantLine = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
      // get line parts - we only care about first one
      const lineParts: string[] = nonCommentConstantLine.split(/[ \t=]/);
      this._logPreProc("  - ln:" + lineNbr + " GetPreProcDecl lineParts=[" + lineParts + "]");
      const directive: string = lineParts[0];
      const symbolName: string | undefined = lineParts.length > 1 ? lineParts[1] : undefined;
      if (this.parseUtils.isFlexspinPreprocessorDirective(directive)) {
        // check a valid preprocessor line for a declaration
        if (symbolName != undefined && directive.toLowerCase() == "#define") {
          this._logPreProc("  -- new PreProc Symbol=[" + symbolName + "]");
          this.semanticFindings.setGlobalToken(symbolName, new RememberedToken("variable", ["readonly"]), lineNbr, this._declarationComment());
        }
      }
    }
  }

  private _getCON_Declaration(startingOffset: number, lineNbr: number, line: string): void {
    // HAVE    DIGIT_NO_VALUE = -2   ' digit value when NOT [0-9]
    //  -or-     _clkmode = xtal1 + pll16x
    //
    if (line.substr(startingOffset).length > 1) {
      //skip Past Whitespace
      let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
      const nonCommentConstantLine = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
      this._logCON("  - ln:" + lineNbr + " GetCONDecl nonCommentConstantLine=[" + nonCommentConstantLine + "]");

      const haveEnumDeclaration: boolean = nonCommentConstantLine.startsWith("#");
      const containsMultiAssignments: boolean = nonCommentConstantLine.indexOf(",") != -1;
      let statements: string[] = [nonCommentConstantLine];
      if (!haveEnumDeclaration && containsMultiAssignments) {
        statements = nonCommentConstantLine.split(",");
      }
      this._logCON("  -- statements=[" + statements + "]");
      for (let index = 0; index < statements.length; index++) {
        const conDeclarationLine: string = statements[index].trim();
        this._logCON("  -- conDeclarationLine=[" + conDeclarationLine + "]");
        currentOffset = line.indexOf(conDeclarationLine, currentOffset);
        const assignmentOffset: number = conDeclarationLine.indexOf("=");
        if (assignmentOffset != -1) {
          // recognize constant name getting initialized via assignment
          // get line parts - we only care about first one
          const lineParts: string[] = line.substr(currentOffset).split(/[ \t=]/);
          const newName = lineParts[0];
          if (newName.substr(0, 1).match(/[a-zA-Z_]/)) {
            this._logCON("  -- GLBL GetCONDecl newName=[" + newName + "]");
            // remember this object name so we can annotate a call to it
            this.semanticFindings.setGlobalToken(newName, new RememberedToken("variable", ["readonly"]), lineNbr, this._declarationComment());
          }
        } else {
          // recognize enum values getting initialized
          const lineParts: string[] = conDeclarationLine.split(/[ \t,]/);
          //this._logCON('  -- lineParts=[' + lineParts + ']');
          for (let index = 0; index < lineParts.length; index++) {
            let enumConstant: string = lineParts[index];
            // our enum name can have a step offset
            if (enumConstant.includes("[")) {
              // it does, isolate name from offset
              const enumNameParts: string[] = enumConstant.split("[");
              enumConstant = enumNameParts[0];
            }
            if (enumConstant.substr(0, 1).match(/[a-zA-Z_]/)) {
              this._logCON("  -- GLBL enumConstant=[" + enumConstant + "]");
              this.semanticFindings.setGlobalToken(enumConstant, new RememberedToken("enumMember", ["readonly"]), lineNbr, this._declarationComment());
            }
          }
        }
      }
    }
  }

  private _getDAT_Declaration(startingOffset: number, lineNbr: number, line: string): void {
    // HAVE    bGammaEnable        BYTE   TRUE               ' comment
    //         didShow             byte   FALSE[256]
    //                             byte   FALSE[256]
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    // get line parts - we only care about first one
    const dataDeclNonCommentStr = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
    let lineParts: string[] = this.parseUtils.getNonWhiteLineParts(dataDeclNonCommentStr);
    this._logDAT("- GetDatDecl lineParts=[" + lineParts + "](" + lineParts.length + ")");
    let haveMoreThanDat: boolean = lineParts.length > 1 && lineParts[0].toUpperCase() == "DAT";
    if (haveMoreThanDat || lineParts[0].toUpperCase() != "DAT") {
      // remember this object name so we can annotate a call to it
      let nameIndex: number = 0;
      let typeIndex: number = 1;
      let maxParts: number = 2;
      if (lineParts[0].toUpperCase() == "DAT") {
        nameIndex = 1;
        typeIndex = 2;
        maxParts = 3;
      }
      let haveLabel: boolean = this.parseUtils.isDatOrPasmLabel(lineParts[nameIndex]);
      const isDataDeclarationLine: boolean = lineParts.length > maxParts - 1 && haveLabel && this.parseUtils.isDatStorageType(lineParts[typeIndex]) ? true : false;
      let lblFlag: string = haveLabel ? "T" : "F";
      let dataDeclFlag: string = isDataDeclarationLine ? "T" : "F";
      this._logDAT("- GetDatDecl lineParts=[" + lineParts + "](" + lineParts.length + ") label=" + lblFlag + ", daDecl=" + dataDeclFlag);
      if (haveLabel) {
        let newName = lineParts[nameIndex];
        if (!this.parseUtils.isSpinReservedWord(newName) && !this.parseUtils.isBuiltinReservedWord(newName)) {
          const nameType: string = isDataDeclarationLine ? "variable" : "label";
          var labelModifiers: string[] = [];
          if (!isDataDeclarationLine) {
            if (newName.startsWith(".")) {
              labelModifiers = ["illegalUse", "static"];
            } else {
              labelModifiers = newName.startsWith(":") ? ["static"] : [];
            }
          }
          this._logDAT("  -- GLBL gddcl newName=[" + newName + "](" + nameType + ")");
          this.semanticFindings.setGlobalToken(newName, new RememberedToken(nameType, labelModifiers), lineNbr, this._declarationComment());
        }
      }
    }
  }

  private _getDAT_PasmDeclaration(startingOffset: number, lineNbr: number, line: string): void {
    // HAVE    bGammaEnable        BYTE   TRUE               ' comment
    //         didShow             byte   FALSE[256]
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    // get line parts - we only care about first one
    const datPasmRHSStr = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
    const lineParts: string[] = this.parseUtils.getNonWhiteLineParts(datPasmRHSStr);
    //this._logPASM('- GetDATPasmDecl lineParts=[' + lineParts + ']');
    // handle name in 1 column
    let haveLabel: boolean = this.parseUtils.isDatOrPasmLabel(lineParts[0]);
    const isDataDeclarationLine: boolean = lineParts.length > 1 && haveLabel && this.parseUtils.isDatStorageType(lineParts[1]) ? true : false;
    if (haveLabel) {
      const labelName: string = lineParts[0];
      if (!this.parseUtils.isReservedPasmSymbols(labelName) && !labelName.toUpperCase().startsWith("IF_")) {
        // org in first column is not label name, nor is if_ conditional
        const labelType: string = isDataDeclarationLine ? "variable" : "label";
        var labelModifiers: string[] = [];
        if (!isDataDeclarationLine) {
          labelModifiers = labelName.startsWith(":") ? ["static"] : [];
        }
        this._logPASM("  -- DAT PASM GLBL labelName=[" + labelName + "(" + labelType + ")]");
        this.semanticFindings.setGlobalToken(labelName, new RememberedToken(labelType, labelModifiers), lineNbr, this._declarationComment());
      }
    }
  }

  private _getOBJ_Declaration(startingOffset: number, lineNbr: number, line: string): void {
    // HAVE    color           : "isp_hub75_color"
    //  -or-   segments[7]     : "isp_hub75_segment"
    //
    //skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const remainingNonCommentLineStr: string = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
    //this._logOBJ('- RptObjDecl remainingNonCommentLineStr=[' + remainingNonCommentLineStr + ']');
    const remainingLength: number = remainingNonCommentLineStr.length;
    if (remainingLength > 0) {
      // get line parts - we only care about first one
      const lineParts: string[] = remainingNonCommentLineStr.split(/[ \t\[\]\:]/).filter(Boolean);
      this._logOBJ("  -- GLBL GetOBJDecl lineParts=[" + lineParts + "]");
      const newName = lineParts[0];
      this._logOBJ("  -- GLBL GetOBJDecl newName=[" + newName + "]");
      // remember this object name so we can annotate a call to it
      this.semanticFindings.setGlobalToken(newName, new RememberedToken("namespace", []), lineNbr, this._declarationComment(), lineParts[1]); // pass filename, too
    }
  }

  private _getPUB_PRI_Name(startingOffset: number, lineNbr: number, line: string): void {
    const methodType = line.substr(0, 3).toUpperCase();
    // reset our list of local variables
    const isPrivate = methodType.indexOf("PRI") != -1;
    //skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const remainingNonCommentLineStr: string = this.parseUtils.getNonCommentLineRemainder(0, line);
    const startNameOffset = currentOffset;
    // find open paren
    currentOffset = remainingNonCommentLineStr.indexOf("(", startNameOffset); // in spin1 ()'s are optional!
    if (currentOffset == -1) {
      currentOffset = remainingNonCommentLineStr.indexOf(":", startNameOffset);
      if (currentOffset == -1) {
        currentOffset = remainingNonCommentLineStr.indexOf("|", startNameOffset);
        if (currentOffset == -1) {
          currentOffset = remainingNonCommentLineStr.indexOf(" ", startNameOffset);
          if (currentOffset == -1) {
            currentOffset = remainingNonCommentLineStr.indexOf("'", startNameOffset);
            // if nothing found...
            if (currentOffset == -1) {
              currentOffset = remainingNonCommentLineStr.length;
            }
          }
        }
      }
    }

    let nameLength = currentOffset - startNameOffset;
    const methodName = line.substr(startNameOffset, nameLength).trim();
    const nameType: string = isPrivate ? "private" : "public";
    this._logSPIN("  -- GLBL GetMethodDecl newName=[" + methodName + "](" + methodName.length + "), type=[" + methodType + "], currentOffset=[" + currentOffset + "]");
    this.currentMethodName = methodName; // notify of latest method name so we can track inLine PASM symbols
    // remember this method name so we can annotate a call to it
    const refModifiers: string[] = isPrivate ? ["static"] : [];
    this.semanticFindings.setGlobalToken(methodName, new RememberedToken("method", refModifiers), lineNbr, this._declarationComment());
    // reset our list of local variables
    this.semanticFindings.clearLocalPasmTokensForMethod(methodName);
    this._logSPIN("  -- _getPUB_PRI_Name() exit");
  }

  private _getVAR_Declaration(startingOffset: number, lineNbr: number, line: string): void {
    // HAVE    long    demoPausePeriod   ' comment
    //
    //skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const remainingNonCommentLineStr: string = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
    this._logVAR("- GetVarDecl remainingNonCommentLineStr=[" + remainingNonCommentLineStr + "]");
    const isMultiDeclaration: boolean = remainingNonCommentLineStr.includes(",");
    let lineParts: string[] = this.parseUtils.getNonWhiteDataInitLineParts(remainingNonCommentLineStr);
    const hasGoodType: boolean = this.parseUtils.isStorageType(lineParts[0]);
    this._logVAR("  -- lineParts=[" + lineParts + "]");
    let nameSet: string[] = [];
    if (hasGoodType && lineParts.length > 1) {
      if (!isMultiDeclaration) {
        // get line parts - we only care about first one after type
        nameSet.push(lineParts[0]);
        nameSet.push(lineParts[1]);
      } else {
        // have multiple declarations separated by commas, we care about all after type
        nameSet = lineParts;
      }
      // remember this object name so we can annotate a call to it
      // NOTE this is an instance-variable!
      for (let index = 1; index < nameSet.length; index++) {
        // remove array suffix and comma delim. from name
        const newName = nameSet[index]; // .replace(/[\[,]/, '');
        if (newName.substr(0, 1).match(/[a-zA-Z_]/)) {
          this._logVAR("  -- GLBL GetVarDecl newName=[" + newName + "]");
          this.semanticFindings.setGlobalToken(newName, new RememberedToken("variable", ["instance"]), lineNbr, this._declarationComment());
        }
      }
    } else if (!hasGoodType && lineParts.length > 0) {
      for (let index = 0; index < lineParts.length; index++) {
        const longVarName = lineParts[index];
        if (longVarName.substr(0, 1).match(/[a-zA-Z_]/)) {
          this._logVAR("  -- GLBL GetVarDecl newName=[" + longVarName + "]");
          this.semanticFindings.setGlobalToken(longVarName, new RememberedToken("variable", ["instance"]), lineNbr, this._declarationComment());
        }
      }
    }
  }

  private _reportPreProcessorLine(lineNbr: number, startingOffset: number, line: string): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    // skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const nonCommentConstantLine = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
    // get line parts - we only care about first one
    const lineParts: string[] = nonCommentConstantLine.split(/[ \t=]/);
    this._logPreProc("  - ln:" + lineNbr + " reportPreProc lineParts=[" + lineParts + "]");
    const directive: string = lineParts[0];
    const symbolName: string | undefined = lineParts.length > 1 ? lineParts[1] : undefined;
    if (this.configuration.highlightFlexspin) {
      if (this.parseUtils.isFlexspinPreprocessorDirective(directive)) {
        // record the directive
        tokenSet.push({
          line: lineNbr,
          startCharacter: 0,
          length: directive.length,
          ptTokenType: "keyword",
          ptTokenModifiers: ["control", "directive"],
        });
        const hasSymbol: boolean =
          directive.toLowerCase() == "#define" ||
          directive.toLowerCase() == "#ifdef" ||
          directive.toLowerCase() == "#ifndef" ||
          directive.toLowerCase() == "#elseifdef" ||
          directive.toLowerCase() == "#elseifndef";
        if (hasSymbol && symbolName != undefined) {
          const nameOffset = line.indexOf(symbolName, currentOffset);
          this._logPreProc("  -- GLBL symbolName=[" + symbolName + "]");
          let referenceDetails: RememberedToken | undefined = undefined;
          if (this.semanticFindings.isGlobalToken(symbolName)) {
            referenceDetails = this.semanticFindings.getGlobalToken(symbolName);
            this._logPreProc("  --  FOUND preProc global " + this._rememberdTokenString(symbolName, referenceDetails));
          }
          if (referenceDetails != undefined) {
            // record a constant declaration!
            const updatedModificationSet: string[] = directive.toLowerCase() == "#define" ? referenceDetails.modifiersWith("declaration") : referenceDetails.modifiers;
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: symbolName.length,
              ptTokenType: referenceDetails.type,
              ptTokenModifiers: updatedModificationSet,
            });
          } else if (this.parseUtils.isFlexspinReservedWord(symbolName)) {
            // record a constant reference
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: symbolName.length,
              ptTokenType: "variable",
              ptTokenModifiers: ["readonly"],
            });
          } else {
            // record an unknown name
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: symbolName.length,
              //ptTokenType: "variable",
              //ptTokenModifiers: ["readonly", "missingDeclaration"],
              ptTokenType: "comment",
              ptTokenModifiers: ["line"],
            });
          }
        }
      }
    } else {
      //  DO NOTHING we don't highlight these (flexspin support not enabled)
      tokenSet.push({
        line: lineNbr,
        startCharacter: 0,
        length: lineParts[0].length,
        ptTokenType: "macro",
        ptTokenModifiers: ["directive", "illegalUse"],
      });
    }

    return tokenSet;
  }

  private _reportCON_DeclarationLine(lineNbr: number, startingOffset: number, line: string): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    // skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const nonCommentConstantLine = this._getNonCommentLineReturnComment(currentOffset, lineNbr, line, tokenSet);

    const haveEnumDeclaration: boolean = nonCommentConstantLine.startsWith("#");
    const containsMultiAssignments: boolean = nonCommentConstantLine.indexOf(",") != -1;
    this._logCON("- reportConstant haveEnum=(" + haveEnumDeclaration + "), containsMulti=(" + containsMultiAssignments + "), nonCommentConstantLine=[" + nonCommentConstantLine + "]");
    let statements: string[] = [nonCommentConstantLine];
    if (!haveEnumDeclaration && containsMultiAssignments) {
      statements = nonCommentConstantLine.split(",");
    }
    this._logCON("  -- statements=[" + statements + "]");
    if (nonCommentConstantLine.length > 0) {
      for (let index = 0; index < statements.length; index++) {
        const conDeclarationLine: string = statements[index].trim();
        this._logCON("  -- conDeclarationLine=[" + conDeclarationLine + "]");
        currentOffset = line.indexOf(conDeclarationLine, currentOffset);
        // locate key indicators of line style
        const isAssignment: boolean = conDeclarationLine.indexOf("=") != -1;
        if (isAssignment && !haveEnumDeclaration) {
          // -------------------------------------------
          // have line assigning value to new constant
          // -------------------------------------------
          const assignmentParts: string[] = conDeclarationLine.split("=");
          const lhsConstantName = assignmentParts[0].trim();
          const nameOffset = line.indexOf(lhsConstantName, currentOffset);
          this._logCON("  -- GLBL lhsConstantName=[" + lhsConstantName + "]");
          let referenceDetails: RememberedToken | undefined = undefined;
          if (this.semanticFindings.isGlobalToken(lhsConstantName)) {
            referenceDetails = this.semanticFindings.getGlobalToken(lhsConstantName);
            this._logCON("  --  FOUND rcdl lhs global " + this._rememberdTokenString(lhsConstantName, referenceDetails));
          }
          if (referenceDetails != undefined) {
            // this is a constant declaration!
            const updatedModificationSet: string[] = referenceDetails.modifiersWith("declaration");
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: lhsConstantName.length,
              ptTokenType: referenceDetails.type,
              ptTokenModifiers: updatedModificationSet,
            });
          } else {
            this._logCON("  --  CON ERROR[CODE] missed recording declaration! name=[" + lhsConstantName + "]");
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: lhsConstantName.length,
              ptTokenType: "variable",
              ptTokenModifiers: ["readonly", "missingDeclaration"],
            });
          }
          // remove front LHS of assignment and process remainder
          const fistEqualOffset: number = conDeclarationLine.indexOf("=");
          const assignmentRHSStr = conDeclarationLine.substring(fistEqualOffset + 1).trim();
          currentOffset = line.indexOf(assignmentRHSStr); // skip to RHS of assignment
          this._logCON("  -- CON assignmentRHSStr=[" + assignmentRHSStr + "]");
          const possNames: string[] = this.parseUtils.getNonWhiteCONLineParts(assignmentRHSStr);
          this._logCON("  -- possNames=[" + possNames + "]");
          for (let index = 0; index < possNames.length; index++) {
            const possibleName = possNames[index];
            const currPossibleLen = possibleName.length;
            currentOffset = line.indexOf(possibleName, currentOffset); // skip to RHS of assignment
            if (possibleName.substr(0, 1).match(/[a-zA-Z_]/)) {
              // does name contain a namespace reference?
              let possibleNameSet: string[] = [];
              let refChar: string = "";
              if (possibleName.includes(".")) {
                refChar = ".";
                possibleNameSet = possibleName.split(".");
                this._logSPIN("  --  . possibleNameSet=[" + possibleNameSet + "]");
              } else if (possibleName.includes("#")) {
                refChar = "#";
                possibleNameSet = possibleName.split("#");
                this._logSPIN("  --  # possibleNameSet=[" + possibleNameSet + "]");
              } else {
                possibleNameSet = [possibleName];
              }
              const namePart = possibleNameSet[0];
              let matchLen: number = namePart.length;
              const searchString: string = possibleNameSet.length == 1 ? possibleNameSet[0] : possibleNameSet[0] + refChar + possibleNameSet[1];
              let referenceDetails: RememberedToken | undefined = undefined;
              const nameOffset = line.indexOf(searchString, currentOffset);
              this._logCON("  -- namePart=[" + namePart + "](" + nameOffset + ")");
              if (this.semanticFindings.isGlobalToken(namePart)) {
                referenceDetails = this.semanticFindings.getGlobalToken(namePart);
                this._logCON("  --  FOUND rcds rhs global " + this._rememberdTokenString(namePart, referenceDetails));
              }
              if (referenceDetails != undefined) {
                // this is a constant reference!
                //const updatedModificationSet: string[] = this._modifiersWithout(referenceDetails.modifiers, "declaration");
                tokenSet.push({
                  line: lineNbr,
                  startCharacter: nameOffset,
                  length: matchLen,
                  ptTokenType: referenceDetails.type,
                  ptTokenModifiers: referenceDetails.modifiers,
                });
              } else {
                if (
                  !this.parseUtils.isSpinReservedWord(namePart) &&
                  !this.parseUtils.isBuiltinReservedWord(namePart) &&
                  !this.parseUtils.isUnaryOperator(namePart) &&
                  !this.parseUtils.isSpinBuiltInConstant(namePart) &&
                  !this.parseUtils.isPasmReservedWord(namePart)
                ) {
                  this._logCON("  --  CON MISSING name=[" + namePart + "]");
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: matchLen,
                    ptTokenType: "variable",
                    ptTokenModifiers: ["readonly", "missingDeclaration"],
                  });
                }
              }
              if (possibleNameSet.length > 1) {
                // we have .constant namespace suffix
                // this can NOT be a method name it can only be a constant name
                const referenceOffset = line.indexOf(searchString, currentOffset);
                const constantPart: string = possibleNameSet[1];
                matchLen = constantPart.length;
                const nameOffset = line.indexOf(constantPart, referenceOffset);
                this._logCON("  -- constantPart=[" + namePart + "](" + nameOffset + ")");
                tokenSet.push({
                  line: lineNbr,
                  startCharacter: nameOffset,
                  length: constantPart.length,
                  ptTokenType: "variable",
                  ptTokenModifiers: ["readonly"],
                });
              }
              currentOffset += matchLen; // skip past this name
            }
          }
        } else {
          // -------------------------------------------------
          // have line creating one or more of enum constants
          // -------------------------------------------------
          // recognize enum values getting initialized
          const lineParts: string[] = conDeclarationLine.split(",");
          //this._logCON('  -- lineParts=[' + lineParts + ']');
          for (let index = 0; index < lineParts.length; index++) {
            let enumConstant = lineParts[index].trim();
            // our enum name can have a step offset: name[step]
            if (enumConstant.includes("[")) {
              // it does, isolate name from offset
              const enumNameParts: string[] = enumConstant.split("[");
              enumConstant = enumNameParts[0];
            }
            if (enumConstant.includes("=")) {
              const enumAssignmentParts: string[] = enumConstant.split("=");
              enumConstant = enumAssignmentParts[0].trim();
              const enumExistingName: string = enumAssignmentParts[1].trim();
              if (enumExistingName.substr(0, 1).match(/[a-zA-Z_]/)) {
                this._logCON("  -- GLBL enumConstant=[" + enumConstant + "]");
                // our enum name can have a step offset
                const nameOffset = line.indexOf(enumExistingName, currentOffset);
                tokenSet.push({
                  line: lineNbr,
                  startCharacter: nameOffset,
                  length: enumExistingName.length,
                  ptTokenType: "enumMember",
                  ptTokenModifiers: ["readonly"],
                });
              }
            }
            if (enumConstant.substr(0, 1).match(/[a-zA-Z_]/)) {
              this._logCON("  -- GLBL enumConstant=[" + enumConstant + "]");
              // our enum name can have a step offset
              const nameOffset = line.indexOf(enumConstant, currentOffset);
              tokenSet.push({
                line: lineNbr,
                startCharacter: nameOffset,
                length: enumConstant.length,
                ptTokenType: "enumMember",
                ptTokenModifiers: ["declaration", "readonly"],
              });
            }
            currentOffset += enumConstant.length + 1;
          }
        }
      }
    }
    return tokenSet;
  }

  private _reportDAT_DeclarationLine(lineNbr: number, startingOffset: number, line: string): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    //skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    // get line parts - we only care about first one
    const dataDeclNonCommentStr = this._getNonCommentLineReturnComment(currentOffset, lineNbr, line, tokenSet);
    let lineParts: string[] = this.parseUtils.getNonWhiteLineParts(dataDeclNonCommentStr);
    this._logVAR("- rptDataDeclLn lineParts=[" + lineParts + "]");
    // remember this object name so we can annotate a call to it
    if (lineParts.length > 0) {
      if (this.parseUtils.isStorageType(lineParts[0]) || lineParts[0].toUpperCase() == "FILE" || lineParts[0].toUpperCase() == "ORG") {
        // if we start with storage type (or FILE, or ORG), not name, process rest of line for symbols
        currentOffset = line.indexOf(lineParts[0], currentOffset);
        const allowLocalVarStatus: boolean = false;
        const NOT_DAT_PASM: boolean = false;
        const partialTokenSet: IParsedToken[] = this._reportDAT_ValueDeclarationCode(lineNbr, currentOffset, line, allowLocalVarStatus, this.showDAT, NOT_DAT_PASM);
        partialTokenSet.forEach((newToken) => {
          tokenSet.push(newToken);
        });
      } else {
        // this is line with name storageType and initial value
        this._logDAT("  -- rptDatDecl lineParts=[" + lineParts + "]");
        let newName = lineParts[0];
        const nameOffset: number = line.indexOf(newName, currentOffset);
        let referenceDetails: RememberedToken | undefined = undefined;
        if (this.semanticFindings.isGlobalToken(newName)) {
          referenceDetails = this.semanticFindings.getGlobalToken(newName);
          this._logMessage("  --  FOUND rddl global name=[" + newName + "]");
        }
        if (referenceDetails != undefined) {
          tokenSet.push({
            line: lineNbr,
            startCharacter: nameOffset,
            length: newName.length,
            ptTokenType: referenceDetails.type,
            ptTokenModifiers: referenceDetails.modifiers,
          });
        } else if (
          !this.parseUtils.isReservedPasmSymbols(newName) &&
          !this.parseUtils.isPasmInstruction(newName) &&
          !this.parseUtils.isPasmConditional(newName) &&
          !this.parseUtils.isDatStorageType(newName) &&
          !this.parseUtils.isBuiltinReservedWord(newName) &&
          !this.parseUtils.isSpinReservedWord(newName) &&
          !newName.toUpperCase().startsWith("IF_")
        ) {
          this._logDAT("  --  DAT rDdl MISSING name=[" + newName + "]");
          tokenSet.push({
            line: lineNbr,
            startCharacter: nameOffset,
            length: newName.length,
            ptTokenType: "variable",
            ptTokenModifiers: ["missingDeclaration"],
          });
        }

        // process remainder of line
        currentOffset = line.indexOf(lineParts[1], nameOffset + newName.length);
        const allowLocalVarStatus: boolean = false;
        const NOT_DAT_PASM: boolean = false;
        const partialTokenSet: IParsedToken[] = this._reportDAT_ValueDeclarationCode(lineNbr, currentOffset, line, allowLocalVarStatus, this.showDAT, NOT_DAT_PASM);
        partialTokenSet.forEach((newToken) => {
          tokenSet.push(newToken);
        });
      }
    } else {
      this._logDAT("  -- DAT SKIPPED: lineParts=[" + lineParts + "]");
    }
    return tokenSet;
  }

  private _reportDAT_ValueDeclarationCode(lineNbr: number, startingOffset: number, line: string, allowLocal: boolean, showDebug: boolean, isDatPasm: boolean): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    //this._logMessage(' DBG _reportDAT_ValueDeclarationCode(#' + lineNumber + ', ofs=' + startingOffset + ')');
    this._logDAT("- process ValueDeclaration line(" + lineNbr + "): line=[" + line + "]: startingOffset=(" + startingOffset + ")");

    // process data declaration
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const dataValueInitStr = this._getNonCommentLineReturnComment(currentOffset, lineNbr, line, tokenSet);
    this._logDAT("- ln(" + lineNbr + "): dataValueInitStr=[" + dataValueInitStr + "]");
    if (dataValueInitStr.length > 1) {
      this._logDAT("  -- reportDataValueInit dataValueInitStr=[" + dataValueInitStr + "]");

      let lineParts: string[] = this.parseUtils.getNonWhiteDataInitLineParts(dataValueInitStr);
      const argumentStartIndex: number = this.parseUtils.isDatStorageType(lineParts[0]) ? 1 : 0;
      this._logDAT("  -- lineParts=[" + lineParts + "]");

      // process remainder of line
      if (lineParts.length < 2) {
        return tokenSet;
      }
      if (lineParts.length > 1) {
        for (let index = argumentStartIndex; index < lineParts.length; index++) {
          const possibleName = lineParts[index].replace(/[\(\)\@]/, "");
          //if (showDebug) {
          //    this._logMessage('  -- possibleName=[' + possibleName + ']');
          //}
          const currPossibleLen = possibleName.length;
          if (currPossibleLen < 1) {
            continue;
          }
          let possibleNameSet: string[] = [];
          // the following allows '.' in names but  only when in DAT PASM code, not spin!
          if (possibleName.substr(0, 1).match(/[a-zA-Z_]/) || (isDatPasm && possibleName.substr(0, 1).match(/[a-zA-Z_\.]/))) {
            if (showDebug) {
              this._logMessage("  -- possibleName=[" + possibleName + "]");
            }
            // does name contain a namespace reference?
            let refChar: string = "";
            if (possibleName.includes(".") && !possibleName.startsWith(".")) {
              refChar = ".";
              possibleNameSet = possibleName.split(".");
              this._logSPIN("  --  . possibleNameSet=[" + possibleNameSet + "]");
            } else if (possibleName.includes("#")) {
              refChar = "#";
              possibleNameSet = possibleName.split("#");
              this._logSPIN("  --  # possibleNameSet=[" + possibleNameSet + "]");
            } else {
              possibleNameSet = [possibleName];
            }
            const namePart = possibleNameSet[0];
            const searchString: string = possibleNameSet.length == 1 ? possibleNameSet[0] : possibleNameSet[0] + refChar + possibleNameSet[1];
            currentOffset = line.indexOf(searchString, currentOffset);
            let referenceDetails: RememberedToken | undefined = undefined;
            if (allowLocal && this.semanticFindings.isLocalToken(namePart)) {
              referenceDetails = this.semanticFindings.getLocalToken(namePart);
              if (showDebug) {
                this._logMessage("  --  FOUND local name=[" + namePart + "]");
              }
            } else if (this.semanticFindings.isGlobalToken(namePart)) {
              referenceDetails = this.semanticFindings.getGlobalToken(namePart);
              if (showDebug) {
                this._logMessage("  --  FOUND global name=[" + namePart + "]");
              }
            }
            if (referenceDetails != undefined) {
              tokenSet.push({
                line: lineNbr,
                startCharacter: currentOffset,
                length: namePart.length,
                ptTokenType: referenceDetails.type,
                ptTokenModifiers: referenceDetails.modifiers,
              });
            } else {
              if (
                !this.parseUtils.isPasmReservedWord(namePart) &&
                !this.parseUtils.isReservedPasmSymbols(namePart) &&
                !this.parseUtils.isPasmInstruction(namePart) &&
                !this.parseUtils.isDatNFileStorageType(namePart) &&
                !this.parseUtils.isBinaryOperator(namePart) &&
                !this.parseUtils.isUnaryOperator(namePart) &&
                !this.parseUtils.isBuiltinReservedWord(namePart)
              ) {
                if (showDebug) {
                  this._logMessage("  --  DAT rDvdc MISSING name=[" + namePart + "]");
                }
                tokenSet.push({
                  line: lineNbr,
                  startCharacter: currentOffset,
                  length: namePart.length,
                  ptTokenType: "variable",
                  ptTokenModifiers: ["missingDeclaration"],
                });
              }
            }
            if (possibleNameSet.length > 1) {
              // we have .constant namespace suffix
              // this can NOT be a method name it can only be a constant name
              const referenceOffset = line.indexOf(searchString, currentOffset);
              const constantPart: string = possibleNameSet[1];
              if (showDebug) {
                this._logMessage("  --  FOUND external constantPart=[" + constantPart + "]");
              }
              const nameOffset = line.indexOf(constantPart, referenceOffset);
              tokenSet.push({
                line: lineNbr,
                startCharacter: nameOffset,
                length: constantPart.length,
                ptTokenType: "variable",
                ptTokenModifiers: ["readonly"],
              });
            }
          }
          currentOffset += currPossibleLen + 1;
        }
      }
    }
    return tokenSet;
  }

  private _reportDAT_PasmCode(lineNbr: number, startingOffset: number, line: string): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    // skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    // get line parts - we only care about first one
    const inLinePasmRHSStr = this._getNonCommentLineReturnComment(currentOffset, lineNbr, line, tokenSet);
    const lineParts: string[] = this.parseUtils.getNonWhitePasmLineParts(inLinePasmRHSStr);
    currentOffset = line.indexOf(inLinePasmRHSStr, currentOffset);
    this._logPASM("  -- reportDATPasmDecl lineParts=[" + lineParts + "]");
    // handle name in 1 column
    let haveLabel: boolean = this.parseUtils.isDatOrPasmLabel(lineParts[0]);
    const isDataDeclarationLine: boolean = lineParts.length > 1 && haveLabel && this.parseUtils.isDatStorageType(lineParts[1]) ? true : false;
    // TODO: REWRITE this to handle "non-label" line with unknown op-code!
    if (haveLabel) {
      // YES Label
      // process label/variable name - starting in column 0
      const labelName: string = lineParts[0];
      this._logPASM("  -- labelName=[" + labelName + "]");
      let referenceDetails: RememberedToken | undefined = undefined;
      if (this.semanticFindings.isGlobalToken(labelName)) {
        referenceDetails = this.semanticFindings.getGlobalToken(labelName);
        this._logPASM("  --  FOUND global name=[" + labelName + "]");
      }
      if (referenceDetails != undefined) {
        const nameOffset = line.indexOf(labelName, currentOffset);
        const updatedModificationSet: string[] = referenceDetails.modifiersWith("declaration");
        this._logPASM("  --  DAT Pasm " + referenceDetails.type + "=[" + labelName + "](" + (nameOffset + 1) + ")");
        tokenSet.push({
          line: lineNbr,
          startCharacter: nameOffset,
          length: labelName.length,
          ptTokenType: referenceDetails.type,
          ptTokenModifiers: updatedModificationSet,
        });
        haveLabel = true;
      } else {
        // NO Label
        // hrmf... no global type???? this should be a label?
        this._logPASM("  --  DAT Pasm ERROR NOT A label=[" + labelName + "](" + (0 + 1) + ")");
        const nameOffset = line.indexOf(labelName, currentOffset);
        tokenSet.push({
          line: lineNbr,
          startCharacter: nameOffset,
          length: labelName.length,
          ptTokenType: "variable", // color this offender!
          ptTokenModifiers: ["illegalUse"],
        });
        haveLabel = true;
      }
    }
    if (!isDataDeclarationLine) {
      // process assembly code
      this._logPASM("  -- reportDATPasmDecl NOT Decl lineParts=[" + lineParts + "]");
      let argumentOffset = 0;
      if (lineParts.length > 1) {
        let minNonLabelParts: number = 1;
        if (haveLabel) {
          // skip our label
          argumentOffset++;
          minNonLabelParts++;
        }
        if (lineParts[argumentOffset].toUpperCase().startsWith("IF_")) {
          // skip our conditional
          argumentOffset++;
          minNonLabelParts++;
        }
        if (lineParts.length > minNonLabelParts) {
          // have at least instruction name
          const likelyInstructionName: string = lineParts[minNonLabelParts - 1];
          currentOffset = line.indexOf(likelyInstructionName, currentOffset);
          this._logPASM("  -- DAT PASM likelyInstructionName=[" + likelyInstructionName + "], currentOffset=(" + currentOffset + ")");
          currentOffset += likelyInstructionName.length + 1;
          for (let index = minNonLabelParts; index < lineParts.length; index++) {
            let argumentName = lineParts[index].replace(/[@#]/, "");
            this._logPASM("  -- DAT PASM checking argumentName=[" + argumentName + "], currentOffset=(" + currentOffset + ")");
            if (argumentName.length < 1) {
              // skip empty operand
              continue;
            }
            if (index == lineParts.length - 1 && this.parseUtils.isPasmConditional(argumentName)) {
              // conditional flag-set spec.
              this._logPASM("  -- SKIP argumentName=[" + argumentName + "]");
              continue;
            }
            const currArgumentLen = argumentName.length;
            const argHasArrayRereference: boolean = argumentName.includes("[");
            if (argHasArrayRereference) {
              const nameParts: string[] = argumentName.split("[");
              argumentName = nameParts[0];
            }
            let nameOffset: number = 0;
            if (argumentName.substr(0, 1).match(/[a-zA-Z_\.\:]/)) {
              // does name contain a namespace reference?
              this._logPASM("  -- argumentName=[" + argumentName + "]");
              let possibleNameSet: string[] = [];
              let refChar: string = "";
              if (argumentName.includes(".") && !argumentName.startsWith(".")) {
                refChar = ".";
                possibleNameSet = argumentName.split(".");
                this._logSPIN("  --  . possibleNameSet=[" + possibleNameSet + "]");
              } else if (argumentName.includes("#")) {
                refChar = "#";
                possibleNameSet = argumentName.split("#");
                this._logSPIN("  --  # possibleNameSet=[" + possibleNameSet + "]");
              } else {
                possibleNameSet = [argumentName];
              }
              const namePart = possibleNameSet[0];
              const searchString: string = possibleNameSet.length == 1 ? possibleNameSet[0] : possibleNameSet[0] + refChar + possibleNameSet[1];
              nameOffset = line.indexOf(searchString, currentOffset);
              this._logPASM("  --  DAT Pasm searchString=[" + searchString + "](" + (nameOffset + 1) + ")");
              let referenceDetails: RememberedToken | undefined = undefined;
              if (this.semanticFindings.isGlobalToken(namePart)) {
                referenceDetails = this.semanticFindings.getGlobalToken(namePart);
                this._logPASM("  --  FOUND global name=[" + namePart + "]");
              }
              if (referenceDetails != undefined) {
                this._logPASM("  --  DAT Pasm name=[" + namePart + "](" + (nameOffset + 1) + ")");
                tokenSet.push({
                  line: lineNbr,
                  startCharacter: nameOffset,
                  length: namePart.length,
                  ptTokenType: referenceDetails.type,
                  ptTokenModifiers: referenceDetails.modifiers,
                });
              } else {
                if (
                  !this.parseUtils.isPasmReservedWord(namePart) &&
                  !this.parseUtils.isPasmInstruction(namePart) &&
                  !this.parseUtils.isPasmConditional(namePart) &&
                  !this.parseUtils.isBinaryOperator(namePart) &&
                  !this.parseUtils.isBuiltinReservedWord(namePart)
                ) {
                  this._logPASM("  --  DAT Pasm MISSING name=[" + namePart + "](" + (nameOffset + 1) + ")");
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: namePart.length,
                    ptTokenType: "variable",
                    ptTokenModifiers: ["readonly", "missingDeclaration"],
                  });
                }
              }
              if (possibleNameSet.length > 1) {
                // we have .constant namespace suffix
                // this can NOT be a method name it can only be a constant name
                const referenceOffset = line.indexOf(searchString, currentOffset);
                const constantPart: string = possibleNameSet[1];
                nameOffset = line.indexOf(constantPart, referenceOffset);
                this._logPASM("  --  DAT Pasm constant=[" + namePart + "](" + (nameOffset + 1) + ")");
                tokenSet.push({
                  line: lineNbr,
                  startCharacter: nameOffset,
                  length: constantPart.length,
                  ptTokenType: "variable",
                  ptTokenModifiers: ["readonly"],
                });
              }
            }
            currentOffset += currArgumentLen + 1;
          }
        }
      } else if (this.parseUtils.isSpin2ReservedWords(lineParts[0])) {
        const namePart: string = lineParts[argumentOffset];
        let nameOffset: number = line.indexOf(namePart, currentOffset);
        this._logPASM("  --  DAT Pasm ILLEGAL use of Pasm2 name=[" + namePart + "](" + (nameOffset + 1) + ")");
        tokenSet.push({
          line: lineNbr,
          startCharacter: nameOffset,
          length: namePart.length,
          ptTokenType: "variable",
          ptTokenModifiers: ["illegalUse"],
        });
      }
    } else {
      // process data declaration
      if (this.parseUtils.isDatStorageType(lineParts[0])) {
        currentOffset = line.indexOf(lineParts[0], currentOffset);
      } else {
        // skip line part 0 length when searching for [1] name
        currentOffset = line.indexOf(lineParts[1], currentOffset + lineParts[0].length);
      }
      const allowLocalVarStatus: boolean = false;
      const IS_DAT_PASM: boolean = true;
      const partialTokenSet: IParsedToken[] = this._reportDAT_ValueDeclarationCode(lineNbr, currentOffset, line, allowLocalVarStatus, this.showPasmCode, IS_DAT_PASM);
      partialTokenSet.forEach((newToken) => {
        tokenSet.push(newToken);
      });
    }

    return tokenSet;
  }

  private _reportPUB_PRI_Signature(lineNbr: number, startingOffset: number, line: string): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    const methodType: string = line.substr(0, 3).toUpperCase();
    const isPrivate = methodType.indexOf("PRI") != -1;
    //skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const spineDeclarationLHSStr = this._getNonCommentLineReturnComment(0, lineNbr, line, tokenSet);
    if (spineDeclarationLHSStr) {
    } // we don't use this string, we called this to record our rhs comment!
    // -----------------------------------
    //   Method Name
    //
    const startNameOffset: number = currentOffset;

    // find open paren - skipping past method name
    currentOffset = spineDeclarationLHSStr.indexOf("(", startNameOffset); // in spin1 ()'s are optional!
    const openParenOffset: number = currentOffset;
    if (currentOffset == -1) {
      currentOffset = spineDeclarationLHSStr.indexOf(":", startNameOffset);
      if (currentOffset == -1) {
        currentOffset = spineDeclarationLHSStr.indexOf("|", startNameOffset);
        if (currentOffset == -1) {
          currentOffset = spineDeclarationLHSStr.indexOf(" ", startNameOffset);
          if (currentOffset == -1) {
            currentOffset = spineDeclarationLHSStr.indexOf("'", startNameOffset);
            if (currentOffset == -1) {
              currentOffset = spineDeclarationLHSStr.length;
            }
          }
        }
      }
    }
    const methodName: string = line.substr(startNameOffset, currentOffset - startNameOffset).trim();
    this.currentMethodName = methodName; // notify of latest method name so we can track inLine PASM symbols
    // record definition of method
    const declModifiers: string[] = isPrivate ? ["declaration", "static"] : ["declaration"];
    tokenSet.push({
      line: lineNbr,
      startCharacter: startNameOffset,
      length: methodName.length,
      ptTokenType: "method",
      ptTokenModifiers: declModifiers,
    });
    this._logSPIN("-reportPubPriSig: methodName=[" + methodName + "](" + startNameOffset + ")");
    this.semanticFindings.clearLocalTokens();
    // -----------------------------------
    //   Parameters
    //
    // find close paren - so we can study parameters
    if (openParenOffset != -1) {
      const closeParenOffset = line.indexOf(")", openParenOffset);
      if (closeParenOffset != -1 && currentOffset + 1 != closeParenOffset) {
        // we have parameter(s)!
        const parameterStr = line.substr(currentOffset + 1, closeParenOffset - currentOffset - 1).trim();
        let parameterNames: string[] = [];
        if (parameterStr.includes(",")) {
          // we have multiple parameters
          parameterNames = parameterStr.split(",");
        } else {
          // we have one parameter
          parameterNames = [parameterStr];
        }
        for (let index = 0; index < parameterNames.length; index++) {
          const paramName = parameterNames[index].trim();
          const nameOffset = line.indexOf(paramName, currentOffset + 1);
          this._logSPIN("  -- paramName=[" + paramName + "](" + nameOffset + ")");
          tokenSet.push({
            line: lineNbr,
            startCharacter: nameOffset,
            length: paramName.length,
            ptTokenType: "parameter",
            ptTokenModifiers: ["declaration", "readonly", "local"],
          });
          // remember so we can ID references
          this.semanticFindings.setLocalToken(paramName, new RememberedToken("parameter", ["readonly", "local"]), lineNbr, this._declarationComment()); // TOKEN SET in _report()
          currentOffset += paramName.length + 1;
        }
      }
    }
    // -----------------------------------
    //   Return Variable(s)
    //
    // find return vars
    const returnValueSep: number = line.indexOf(":", currentOffset);
    const localVarsSep: number = line.indexOf("|", currentOffset);
    let beginCommentOffset: number = line.indexOf("'", currentOffset);
    if (beginCommentOffset === -1) {
      beginCommentOffset = line.indexOf("{", currentOffset);
    }
    const nonCommentEOL: number = beginCommentOffset != -1 ? beginCommentOffset - 1 : line.length - 1;
    const returnVarsEnd: number = localVarsSep != -1 ? localVarsSep - 1 : nonCommentEOL;
    let returnValueNames: string[] = [];
    if (returnValueSep != -1) {
      // we have return var(s)!
      // we move currentOffset along so we don't falsely find short variable names earlier in string!
      currentOffset = returnValueSep + 1;
      const varNameStr = line.substr(returnValueSep + 1, returnVarsEnd - returnValueSep).trim();
      if (varNameStr.indexOf(",")) {
        // have multiple return value names
        returnValueNames = varNameStr.split(",");
      } else {
        // have a single return value name
        returnValueNames = [varNameStr];
      }
      for (let index = 0; index < returnValueNames.length; index++) {
        const returnValueName = returnValueNames[index].trim();
        const nameOffset = line.indexOf(returnValueName, currentOffset);
        this._logSPIN("  -- returnValueName=[" + returnValueName + "](" + nameOffset + ")");
        tokenSet.push({
          line: lineNbr,
          startCharacter: nameOffset,
          length: returnValueName.length,
          ptTokenType: "returnValue",
          ptTokenModifiers: ["declaration", "local"],
        });
        // remember so we can ID references
        this.semanticFindings.setLocalToken(returnValueName, new RememberedToken("returnValue", ["local"]), lineNbr, this._declarationComment()); // TOKEN SET in _report()
        currentOffset += returnValueName.length + 1; // +1 for trailing comma
      }
    }
    // -----------------------------------
    //   Local Variable(s)
    //
    // find local vars
    if (localVarsSep != -1) {
      // we have local var(s)!
      const localVarStr = line.substr(localVarsSep + 1, nonCommentEOL - localVarsSep).trim();
      // we move currentOffset along so we don't falsely find short variable names earlier in string!
      currentOffset = localVarsSep + 1;
      let localVarNames: string[] = [];
      if (localVarStr.indexOf(",")) {
        // have multiple return value names
        localVarNames = localVarStr.split(",");
      } else {
        // have a single return value name
        localVarNames = [localVarStr];
      }
      this._logSPIN("  -- localVarNames=[" + localVarNames + "]");
      for (let index = 0; index < localVarNames.length; index++) {
        const localVariableName = localVarNames[index].trim();
        const localVariableOffset = line.indexOf(localVariableName, currentOffset);
        let nameParts: string[] = [];
        if (localVariableName.includes(" ")) {
          // have name with storage and/or alignment operators
          nameParts = localVariableName.split(" ");
        } else {
          // have single name
          nameParts = [localVariableName];
        }
        this._logSPIN("  -- nameParts=[" + nameParts + "]");
        for (let index = 0; index < nameParts.length; index++) {
          let localName = nameParts[index];
          // have name similar to scratch[12]?
          if (localName.includes("[")) {
            // yes remove array suffix
            const lineInfo: IFilteredStrings = this._getNonWhiteSpinLineParts(localName);
            let localNameParts: string[] = lineInfo.lineParts;
            localName = localNameParts[0];
            for (let index = 1; index < localNameParts.length; index++) {
              const namedIndexPart = localNameParts[index];
              const nameOffset = line.indexOf(namedIndexPart, currentOffset);
              if (namedIndexPart.substr(0, 1).match(/[a-zA-Z_]/)) {
                let referenceDetails: RememberedToken | undefined = undefined;
                if (this.semanticFindings.isLocalToken(namedIndexPart)) {
                  referenceDetails = this.semanticFindings.getLocalToken(namedIndexPart);
                  this._logSPIN("  --  FOUND local name=[" + namedIndexPart + "]");
                } else if (this.semanticFindings.isGlobalToken(namedIndexPart)) {
                  referenceDetails = this.semanticFindings.getGlobalToken(namedIndexPart);
                  this._logSPIN("  --  FOUND global name=[" + namedIndexPart + "]");
                }
                if (referenceDetails != undefined) {
                  this._logSPIN("  --  lcl-idx variableName=[" + namedIndexPart + "](" + (nameOffset + 1) + ")");
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: namedIndexPart.length,
                    ptTokenType: referenceDetails.type,
                    ptTokenModifiers: referenceDetails.modifiers,
                  });
                } else {
                  if (!this.parseUtils.isSpinReservedWord(namedIndexPart) && !this.parseUtils.isSpinBuiltinMethod(namedIndexPart) && !this.parseUtils.isBuiltinReservedWord(namedIndexPart)) {
                    // we don't have name registered so just mark it
                    this._logSPIN("  --  SPIN MISSING varname=[" + namedIndexPart + "](" + (nameOffset + 1) + ")");
                    tokenSet.push({
                      line: lineNbr,
                      startCharacter: nameOffset,
                      length: namedIndexPart.length,
                      ptTokenType: "variable",
                      ptTokenModifiers: ["missingDeclaration"],
                    });
                  }
                }
              }
            }
          }
          const nameOffset = line.indexOf(localName, localVariableOffset);
          this._logSPIN("  -- localName=[" + localName + "](" + nameOffset + ")");
          if (index == nameParts.length - 1) {
            // have name
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: localName.length,
              ptTokenType: "variable",
              ptTokenModifiers: ["declaration", "local"],
            });
            // remember so we can ID references
            this.semanticFindings.setLocalToken(localName, new RememberedToken("variable", ["local"]), lineNbr, this._declarationComment()); // TOKEN SET in _report()
          } else {
            // have modifier!
            if (this.parseUtils.isStorageType(localName)) {
              tokenSet.push({
                line: lineNbr,
                startCharacter: nameOffset,
                length: localName.length,
                ptTokenType: "storageType",
                ptTokenModifiers: [],
              });
            }
          }
        }
        currentOffset += localVariableName.length + 1; // +1 for trailing comma
      }
    }
    return tokenSet;
  }

  private _reportSPIN_Code(lineNbr: number, startingOffset: number, line: string): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    // skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const nonCommentSpinLine = this._getNonCommentLineReturnComment(currentOffset, lineNbr, line, tokenSet);
    const remainingLength: number = nonCommentSpinLine.length;
    this._logCON("- reportSPIN nonCommentSpinLine=[" + nonCommentSpinLine + "] remainingLength=" + remainingLength);
    if (remainingLength > 0) {
      // special early error case
      if (nonCommentSpinLine.toLowerCase().includes("else if")) {
        const nameOffset = line.toLowerCase().indexOf("else if", currentOffset);
        this._logSPIN("  --  Illegal ELSE-IF [" + nonCommentSpinLine + "]");
        tokenSet.push({
          line: lineNbr,
          startCharacter: nameOffset,
          length: "else if".length,
          ptTokenType: "keyword",
          ptTokenModifiers: ["illegalUse"],
        });
      }
      // locate key indicators of line style
      let assignmentOffset: number = line.indexOf(":=", currentOffset);
      if (assignmentOffset != -1) {
        // -------------------------------------------
        // have line assigning value to variable(s)
        //  Process LHS side of this assignment
        // -------------------------------------------
        const possibleVariableName = line.substr(currentOffset, assignmentOffset - currentOffset).trim();
        this._logSPIN("  -- LHS: possibleVariableName=[" + possibleVariableName + "]");
        let varNameList: string[] = [possibleVariableName];
        if (possibleVariableName.includes(",")) {
          varNameList = possibleVariableName.split(",");
        }
        if (possibleVariableName.includes(" ")) {
          // force special case range chars to be removed
          //  Ex: RESP_OVER..RESP_NOT_FOUND : error_code.byte[3] := mod
          // change .. to : so it is removed by getNonWhite...
          const filteredLine: string = possibleVariableName.replace("..", ":");
          const lineInfo: IFilteredStrings = this._getNonWhiteSpinLineParts(filteredLine);
          varNameList = lineInfo.lineParts;
        }
        this._logSPIN("  -- LHS: varNameList=[" + varNameList + "]");
        for (let index = 0; index < varNameList.length; index++) {
          let variableName: string = varNameList[index];
          const variableNameLen: number = variableName.length;
          if (variableName.includes("[")) {
            // NOTE this handles code: byte[pColor][2] := {value}
            //outa[D7..D4] := %0011               P1 OBEX:LCD SPIN driver - 2x16.spin (315)

            // have complex target name, parse in loop (remove our range specifier '..')
            if (variableName.includes("..")) {
              variableName = variableName.replace("..", " ");
            }
            const variableNameParts: string[] = variableName.split(/[ \t\[\]\/\*\+\-\(\)\<\>]/);
            this._logSPIN("  -- LHS: [] variableNameParts=[" + variableNameParts + "]");
            let haveModification: boolean = false;
            for (let index = 0; index < variableNameParts.length; index++) {
              let variableNamePart = variableNameParts[index].replace("@", "");
              // secial case handle datar.[i] which leaves var name as 'darar.'
              if (variableNamePart.endsWith(".")) {
                variableNamePart = variableNamePart.substr(0, variableNamePart.length - 1);
              }
              const nameOffset = line.indexOf(variableNamePart, currentOffset);
              if (variableNamePart.substr(0, 1).match(/[a-zA-Z_]/)) {
                if (variableNamePart.includes(".")) {
                  const varNameParts: string[] = variableNamePart.split(".");
                  if (this.parseUtils.isDatStorageType(varNameParts[1])) {
                    variableNamePart = varNameParts[0]; // just use first part of name
                    /*
                                        // FIXME: UNDONE mark storage part correctly, yes, out-of-order
                                        const nameOffset: number = line.indexOf(varNameParts[1]);
                                        this._logSPIN('  --  SPIN storageType=[' + varNameParts[1] + '](' + (nameOffset + 1) + ')');
                                        tokenSet.push({
                                            line: lineNbr,
                                            startCharacter: nameOffset,
                                            length: varNameParts[1].length,
                                            ptTokenType: 'storageType',
                                            ptTokenModifiers: []
                                        });
                                        */
                  }
                }
                this._logSPIN("  -- variableNamePart=[" + variableNamePart + "](" + (nameOffset + 1) + ")");
                if (this.parseUtils.isStorageType(variableNamePart)) {
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: variableNamePart.length,
                    ptTokenType: "storageType",
                    ptTokenModifiers: [],
                  });
                } else {
                  let referenceDetails: RememberedToken | undefined = undefined;
                  if (this.semanticFindings.isLocalToken(variableNamePart)) {
                    referenceDetails = this.semanticFindings.getLocalToken(variableNamePart);
                    this._logSPIN("  --  FOUND local name=[" + variableNamePart + "]");
                  } else if (this.semanticFindings.isGlobalToken(variableNamePart)) {
                    referenceDetails = this.semanticFindings.getGlobalToken(variableNamePart);
                    this._logSPIN("  --  FOUND global name=[" + variableNamePart + "]");
                  }
                  if (referenceDetails != undefined) {
                    const modificationArray: string[] = referenceDetails.modifiersWith("modification");
                    this._logSPIN("  --  SPIN variableName=[" + variableNamePart + "](" + (nameOffset + 1) + ")");
                    tokenSet.push({
                      line: lineNbr,
                      startCharacter: nameOffset,
                      length: variableNamePart.length,
                      ptTokenType: referenceDetails.type,
                      ptTokenModifiers: modificationArray,
                    });
                  } else {
                    if (!this.parseUtils.isSpinReservedWord(variableNamePart) && !this.parseUtils.isBuiltinReservedWord(variableNamePart) && !this.parseUtils.isSpinBuiltinMethod(variableNamePart)) {
                      // we don't have name registered so just mark it
                      this._logSPIN("  --  SPIN MISSING varname=[" + variableNamePart + "](" + (nameOffset + 1) + ")");
                      tokenSet.push({
                        line: lineNbr,
                        startCharacter: nameOffset,
                        length: variableNamePart.length,
                        ptTokenType: "variable",
                        ptTokenModifiers: ["modification", "missingDeclaration"],
                      });
                    }
                  }
                }
              }
            }
          } else {
            // have simple target name, no []
            let cleanedVariableName: string = variableName.replace(/[ \t\(\)]/, "");
            let nameOffset = line.indexOf(cleanedVariableName, currentOffset);
            if (cleanedVariableName.substr(0, 1).match(/[a-zA-Z_]/) && !this.parseUtils.isStorageType(cleanedVariableName)) {
              this._logSPIN("  --  SPIN cleanedVariableName=[" + cleanedVariableName + "](" + (nameOffset + 1) + ")");
              if (cleanedVariableName.includes(".")) {
                const varNameParts: string[] = cleanedVariableName.split(".");
                if (this.parseUtils.isDatStorageType(varNameParts[1])) {
                  cleanedVariableName = varNameParts[0]; // just use first part of name
                  /*
                                    // FIXME: UNDONE mark storage part correctly, yes, out-of-order
                                    const nameOffset: number = line.indexOf(varNameParts[1]);
                                    this._logSPIN('  --  SPIN storageType=[' + varNameParts[1] + '](' + (nameOffset + 1) + ')');
                                    tokenSet.push({
                                        line: lineNbr,
                                        startCharacter: nameOffset,
                                        length: varNameParts[1].length,
                                        ptTokenType: 'storageType',
                                        ptTokenModifiers: []
                                    });
                                    */
                } else {
                  // XYZZY new . handling code
                  const didReport: boolean = this._reportObjectReference(varNameParts.join("."), lineNbr, nameOffset, line, tokenSet);
                }
              }
              let referenceDetails: RememberedToken | undefined = undefined;
              if (this.semanticFindings.isLocalToken(cleanedVariableName)) {
                referenceDetails = this.semanticFindings.getLocalToken(cleanedVariableName);
                this._logSPIN("  --  FOUND local name=[" + cleanedVariableName + "]");
              } else if (this.semanticFindings.isGlobalToken(cleanedVariableName)) {
                referenceDetails = this.semanticFindings.getGlobalToken(cleanedVariableName);
                this._logSPIN("  --  FOUND globel name=[" + cleanedVariableName + "]");
              }
              if (referenceDetails != undefined) {
                const modificationArray: string[] = referenceDetails.modifiersWith("modification");
                this._logSPIN("  -- spin: simple variableName=[" + cleanedVariableName + "](" + (nameOffset + 1) + ")");
                tokenSet.push({
                  line: lineNbr,
                  startCharacter: nameOffset,
                  length: cleanedVariableName.length,
                  ptTokenType: referenceDetails.type,
                  ptTokenModifiers: modificationArray,
                });
              } else if (cleanedVariableName == "_") {
                this._logSPIN("  --  built-in=[" + cleanedVariableName + "](" + (nameOffset + 1) + ")");
                tokenSet.push({
                  line: lineNbr,
                  startCharacter: nameOffset,
                  length: cleanedVariableName.length,
                  ptTokenType: "variable",
                  ptTokenModifiers: ["modification", "defaultLibrary"],
                });
                /*
              } else if (cleanedVariableName.toLowerCase() == "result") {
                this._logSPIN("  --  SPIN return Special Name=[" + cleanedVariableName + "]");
                tokenSet.push({
                  line: lineNbr,
                  startCharacter: nameOffset,
                  length: cleanedVariableName.length,
                  ptTokenType: "returnValue",
                  ptTokenModifiers: ["declaration", "local"],
                });
                  */
              } else {
                // we don't have name registered so just mark it
                if (
                  !this.parseUtils.isSpinReservedWord(cleanedVariableName) &&
                  !this.parseUtils.isSpinBuiltinMethod(cleanedVariableName) &&
                  !this.parseUtils.isBuiltinReservedWord(cleanedVariableName)
                ) {
                  this._logSPIN("  --  SPIN MISSING cln name=[" + cleanedVariableName + "](" + (nameOffset + 1) + ")");
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: cleanedVariableName.length,
                    ptTokenType: "variable",
                    ptTokenModifiers: ["modification", "missingDeclaration"],
                  });
                }
              }
            }
          }
          currentOffset += variableNameLen + 1;
        }
        currentOffset = assignmentOffset + 2;
      }
      // -------------------------------------------
      // could be line with RHS of assignment or a
      //  line with no assignment (process it)
      // -------------------------------------------
      const assignmentRHSStr: string = this._getNonCommentLineReturnComment(currentOffset, lineNbr, line, tokenSet);
      currentOffset = line.indexOf(assignmentRHSStr, currentOffset);
      const preCleanAssignmentRHSStr = this.parseUtils.getNonInlineCommentLine(assignmentRHSStr).replace("..", "  ");
      this._logSPIN("  -- SPIN assignmentRHSStr=[" + assignmentRHSStr + "]");
      const lineInfo: IFilteredStrings = this._getNonWhiteSpinLineParts(preCleanAssignmentRHSStr);
      let possNames: string[] = lineInfo.lineParts;
      const nonStringAssignmentRHSStr: string = lineInfo.lineNoQuotes;
      let currNonStringOffset = 0;
      // special code to handle case range strings:  [e.g., SEG_TOP..SEG_BOTTOM:]
      //const isCaseValue: boolean = assignmentRHSStr.endsWith(':');
      //if (isCaseValue && possNames[0].includes("..")) {
      //    possNames = possNames[0].split("..");
      //}
      this._logSPIN("  -- possNames=[" + possNames + "]");
      const firstName: string = possNames.length > 0 ? possNames[0] : "";
      for (let index = 0; index < possNames.length; index++) {
        let possibleName = possNames[index];
        // special code to handle case of var.[bitfield] leaving name a 'var.'
        if (possibleName.endsWith(".")) {
          possibleName = possibleName.substr(0, possibleName.length - 1);
        }
        let possibleNameSet: string[] = [];
        let nameOffset: number = 0;
        currNonStringOffset = nonStringAssignmentRHSStr.indexOf(possNames[index], currNonStringOffset);
        const currNonStringNameLen: number = possNames[index].length;
        if (possibleName.substr(0, 1).match(/[a-zA-Z_]/)) {
          this._logSPIN("  -- possibleName=[" + possibleName + "]");
          // does name contain a namespace reference?
          let refChar: string = "";
          if (possibleName.includes(".")) {
            refChar = ".";
            possibleNameSet = possibleName.split(".");
            this._logSPIN("  --  . possibleNameSet=[" + possibleNameSet + "]");
          } else if (possibleName.includes("#")) {
            refChar = "#";
            possibleNameSet = possibleName.split("#");
            this._logSPIN("  --  # possibleNameSet=[" + possibleNameSet + "]");
          } else {
            possibleNameSet = [possibleName];
          }
          const namePart = possibleNameSet[0];
          const searchString: string = possibleNameSet.length == 1 ? possibleNameSet[0] : possibleNameSet[0] + refChar + possibleNameSet[1];
          nameOffset = nonStringAssignmentRHSStr.indexOf(searchString, currNonStringOffset) + currentOffset;
          this._logSPIN("  --  SPIN RHS  nonStringAssignmentRHSStr=[" + nonStringAssignmentRHSStr + "]");
          this._logSPIN("  --  SPIN RHS   searchString=[" + searchString + "], namePart=[" + namePart + "]");
          this._logSPIN("  --  SPIN RHS    nameOffset=(" + nameOffset + "), currNonStringOffset=(" + currNonStringOffset + "), currentOffset=(" + currentOffset + ")");
          let referenceDetails: RememberedToken | undefined = undefined;
          if (this.semanticFindings.isLocalToken(namePart)) {
            referenceDetails = this.semanticFindings.getLocalToken(namePart);
            this._logSPIN("  --  FOUND local name=[" + namePart + "]");
          } else if (this.semanticFindings.isGlobalToken(namePart)) {
            referenceDetails = this.semanticFindings.getGlobalToken(namePart);
            this._logSPIN("  --  FOUND global name=[" + namePart + "]");
          }
          if (referenceDetails != undefined) {
            this._logSPIN("  --  SPIN RHS name=[" + namePart + "](" + (nameOffset + 1) + ")");
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: namePart.length,
              ptTokenType: referenceDetails.type,
              ptTokenModifiers: referenceDetails.modifiers,
            });
          } else {
            // have unknown name!? is storage type spec?
            if (this.parseUtils.isStorageType(namePart)) {
              this._logSPIN("  --  SPIN RHS storageType=[" + namePart + "]");
              tokenSet.push({
                line: lineNbr,
                startCharacter: nameOffset,
                length: namePart.length,
                ptTokenType: "storageType",
                ptTokenModifiers: [],
              });
            } else if (this.parseUtils.isSpinBuiltInConstant(namePart)) {
              this._logSPIN("  --  SPIN RHS builtin constant=[" + namePart + "]");
              tokenSet.push({
                line: lineNbr,
                startCharacter: nameOffset,
                length: namePart.length,
                ptTokenType: "variable",
                ptTokenModifiers: ["readonly", "defaultLibrary"],
              });
              /*
            } else if (namePart.toLowerCase() == "result") {
              this._logSPIN("  --  SPIN return Special Name=[" + namePart + "]");
              tokenSet.push({
                line: lineNbr,
                startCharacter: nameOffset,
                length: namePart.length,
                ptTokenType: "returnValue",
                ptTokenModifiers: ["declaration", "local"],
              });
              */
            } else if (
              !this.parseUtils.isSpinReservedWord(namePart) &&
              !this.parseUtils.isSpinBuiltinMethod(namePart) &&
              !this.parseUtils.isSpinBuiltInVariable(namePart) &&
              !this.parseUtils.isBuiltinReservedWord(namePart)
            ) {
              // NO DEBUG FOR ELSE, most of spin control elements come through here!
              //else {
              //    this._logSPIN('  -- UNKNOWN?? name=[' + namePart + '] - name-get-breakage??');
              //}

              this._logSPIN("  --  SPIN MISSING rhs name=[" + namePart + "]");
              tokenSet.push({
                line: lineNbr,
                startCharacter: nameOffset,
                length: namePart.length,
                ptTokenType: "variable",
                ptTokenModifiers: ["missingDeclaration"],
              });
            } else {
              this._logSPIN("  --  SPIN ??? What to do with: rhs name=[" + namePart + "]");
            }
          }
          if (possibleNameSet.length > 1) {
            // we have .methodName or #constantName namespace suffix
            // determine if this is method has '(' or constant name
            const referenceOffset = nonStringAssignmentRHSStr.indexOf(searchString, currNonStringOffset) + currentOffset;
            let isMethod: boolean = false;
            if (line.substr(referenceOffset + searchString.length, 1) == "(") {
              isMethod = true;
            } else if (refChar == ".") {
              // spin1 does NOT require name() method calls!
              // TODO: do better!!!  FLAWED   -> HUH?? really force all to methods for now???
              isMethod = true;
            }
            const constantPart: string = possibleNameSet[1];
            if (this.parseUtils.isStorageType(constantPart)) {
              // FIXME: UNDONE remove when syntax see this correctly
              const nameOffset: number = line.indexOf(constantPart, currentOffset);
              this._logSPIN("  --  SPIN rhs storageType=[" + constantPart + "](" + (nameOffset + 1) + ")");
              tokenSet.push({
                line: lineNbr,
                startCharacter: nameOffset,
                length: constantPart.length,
                ptTokenType: "storageType",
                ptTokenModifiers: [],
              });
            } else {
              nameOffset = nonStringAssignmentRHSStr.indexOf(constantPart, currNonStringOffset) + currentOffset;
              const tokenTypeID: string = isMethod ? "method" : "variable";
              const tokenModifiers: string[] = isMethod ? [] : ["readonly"];
              this._logSPIN("  --  SPIN rhs constant=[" + constantPart + "](" + (nameOffset + 1) + ") (" + tokenTypeID + ")");
              tokenSet.push({
                line: lineNbr,
                startCharacter: nameOffset,
                length: constantPart.length,
                ptTokenType: tokenTypeID,
                ptTokenModifiers: tokenModifiers,
              });
            }
          }
        } else if (possibleName.startsWith(".")) {
          const externalMethodName: string = possibleName.replace(".", "");
          nameOffset = nonStringAssignmentRHSStr.indexOf(externalMethodName, currNonStringOffset) + currentOffset;
          this._logSPIN("  --  SPIN rhs externalMethodName=[" + externalMethodName + "](" + (nameOffset + 1) + ")");
          tokenSet.push({
            line: lineNbr,
            startCharacter: nameOffset,
            length: externalMethodName.length,
            ptTokenType: "method",
            ptTokenModifiers: [],
          });
        }
        currNonStringOffset += currNonStringNameLen + 1;
      }
    }
    return tokenSet;
  }

  private _reportSPIN_PasmCode(lineNbr: number, startingOffset: number, line: string): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    // skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    // get line parts - we only care about first one
    const inLinePasmRHSStr = this._getNonCommentLineReturnComment(currentOffset, lineNbr, line, tokenSet);
    const lineParts: string[] = this.parseUtils.getNonWhitePasmLineParts(inLinePasmRHSStr);
    this._logPASM("  -- reportInLinePasmDecl lineParts=[" + lineParts + "]");
    if (lineParts.length == 0) {
      return tokenSet;
    }
    // handle name in as first part of line...
    // (process label/variable name)
    let haveLabel: boolean = this.parseUtils.isDatOrPasmLabel(lineParts[0]);
    const isDataDeclarationLine: boolean = lineParts.length > 1 && haveLabel && this.parseUtils.isDatStorageType(lineParts[1]) ? true : false;
    if (haveLabel) {
      const labelName: string = lineParts[0];
      this._logPASM("  -- labelName=[" + labelName + "]");
      const labelType: string = isDataDeclarationLine ? "variable" : "label";
      const nameOffset: number = line.indexOf(labelName, currentOffset);
      var labelModifiers: string[] = [];
      if (!isDataDeclarationLine) {
        labelModifiers = labelName.startsWith(":") ? ["declaration", "static"] : ["declaration"];
      }
      tokenSet.push({
        line: lineNbr,
        startCharacter: nameOffset,
        length: labelName.length,
        ptTokenType: labelType,
        ptTokenModifiers: labelModifiers,
      });
      haveLabel = true;
    }
    if (!isDataDeclarationLine) {
      // process assembly code
      let argumentOffset = 0;
      if (lineParts.length > 1) {
        let minNonLabelParts: number = 1;
        if (haveLabel) {
          // skip our label
          argumentOffset++;
          minNonLabelParts++;
        }
        if (lineParts[argumentOffset].toUpperCase().startsWith("IF_")) {
          // skip our conditional
          argumentOffset++;
          minNonLabelParts++;
        }
        const possibleDirective: string = lineParts[argumentOffset];
        if (possibleDirective.toUpperCase() == "FILE") {
          // we have illegal so flag it and abort handling rest of line
          this._logPASM("  --  SPIN inlinePasm ERROR[CODE] illegal directive=[" + possibleDirective + "]");
          const nameOffset: number = line.indexOf(possibleDirective, currentOffset);
          tokenSet.push({
            line: lineNbr,
            startCharacter: nameOffset,
            length: possibleDirective.length,
            ptTokenType: "variable",
            ptTokenModifiers: ["illegalUse"],
          });
        } else {
          if (lineParts.length > minNonLabelParts) {
            currentOffset = line.indexOf(lineParts[minNonLabelParts - 1], currentOffset) + lineParts[minNonLabelParts - 1].length + 1;
            for (let index = minNonLabelParts; index < lineParts.length; index++) {
              const argumentName = lineParts[index].replace(/[@#]/, "");
              if (argumentName.length < 1) {
                // skip empty operand
                continue;
              }
              if (index == lineParts.length - 1 && this.parseUtils.isPasmConditional(argumentName)) {
                // conditional flag-set spec.
                this._logPASM("  -- SKIP argumentName=[" + argumentName + "]");
                continue;
              }
              const currArgumentLen = argumentName.length;
              if (argumentName.substr(0, 1).match(/[a-zA-Z_\.]/)) {
                // does name contain a namespace reference?
                let refChar: string = "";
                this._logPASM("  -- argumentName=[" + argumentName + "]");
                let possibleNameSet: string[] = [];
                if (argumentName.includes(".") && !argumentName.startsWith(".")) {
                  refChar = ".";
                  possibleNameSet = argumentName.split(".");
                  this._logSPIN("  --  . possibleNameSet=[" + possibleNameSet + "]");
                } else if (argumentName.includes("#")) {
                  refChar = "#";
                  possibleNameSet = argumentName.split("#");
                  this._logSPIN("  --  # possibleNameSet=[" + possibleNameSet + "]");
                } else {
                  possibleNameSet = [argumentName];
                }
                const namePart = possibleNameSet[0];
                const searchString: string = possibleNameSet.length == 1 ? possibleNameSet[0] : possibleNameSet[0] + refChar + possibleNameSet[1];
                const nameOffset = line.indexOf(searchString, currentOffset);
                let referenceDetails: RememberedToken | undefined = undefined;
                if (this.semanticFindings.hasLocalPasmTokenForMethod(this.currentMethodName, namePart)) {
                  referenceDetails = this.semanticFindings.getLocalPasmTokenForMethod(this.currentMethodName, namePart);
                  this._logPASM("  --  FOUND local PASM name=[" + namePart + "]");
                } else if (this.semanticFindings.isLocalToken(namePart)) {
                  referenceDetails = this.semanticFindings.getLocalToken(namePart);
                  this._logPASM("  --  FOUND local name=[" + namePart + "]");
                } else if (this.semanticFindings.isGlobalToken(namePart)) {
                  referenceDetails = this.semanticFindings.getGlobalToken(namePart);
                  this._logPASM("  --  FOUND global name=[" + namePart + "]");
                }
                if (referenceDetails != undefined) {
                  this._logPASM("  --  SPIN inlinePASM add name=[" + namePart + "]");
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: namePart.length,
                    ptTokenType: referenceDetails.type,
                    ptTokenModifiers: referenceDetails.modifiers,
                  });
                } else {
                  // we don't have name registered so just mark it
                  if (namePart != ".") {
                    // odd special case!
                    if (!this.parseUtils.isSpinReservedWord(namePart) && !this.parseUtils.isBuiltinReservedWord(namePart)) {
                      this._logPASM("  --  SPIN Pasm MISSING name=[" + namePart + "]");
                      tokenSet.push({
                        line: lineNbr,
                        startCharacter: nameOffset,
                        length: namePart.length,
                        ptTokenType: "variable",
                        ptTokenModifiers: ["missingDeclaration"],
                      });
                    }
                  }
                }
                if (possibleNameSet.length > 1) {
                  // we have .constant namespace suffix
                  // this can NOT be a method name it can only be a constant name
                  this._logPASM("  --  SPIN inlinePasm constant name=[" + possibleNameSet[1] + "]");
                  const referenceOffset = line.indexOf(searchString, currentOffset);
                  const constantPart: string = possibleNameSet[1];
                  const nameOffset = line.indexOf(constantPart, referenceOffset);
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: constantPart.length,
                    ptTokenType: "variable",
                    ptTokenModifiers: ["readonly"],
                  });
                }
              }
              currentOffset += currArgumentLen + 1;
            }
          }
        }
      } else {
        // have only 1 line part is directive or op-code
        // flag non-opcode or illegal directive
        const nameOrDirective: string = lineParts[0];
        // if this symbol is NOT a global token then it could be bad!
        if (!this.semanticFindings.isKnownToken(nameOrDirective)) {
          if (!this.parseUtils.isPasmInstruction(nameOrDirective)) {
            this._logPASM("  --  SPIN inline-Pasm MISSING name=[" + nameOrDirective + "]");
            const nameOffset = line.indexOf(nameOrDirective, currentOffset);
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: nameOrDirective.length,
              ptTokenType: "variable", // color this offender!
              ptTokenModifiers: ["illegalUse"],
            });
          }
        }
      }
    } else {
      // process data declaration
      if (this.parseUtils.isDatStorageType(lineParts[0])) {
        currentOffset = line.indexOf(lineParts[0], currentOffset);
      } else {
        currentOffset = line.indexOf(lineParts[1], currentOffset);
      }
      const allowLocalVarStatus: boolean = true;
      const NOT_DAT_PASM: boolean = false;
      const partialTokenSet: IParsedToken[] = this._reportDAT_ValueDeclarationCode(lineNbr, currentOffset, line, allowLocalVarStatus, this.showPasmCode, NOT_DAT_PASM);
      partialTokenSet.forEach((newToken) => {
        tokenSet.push(newToken);
      });
    }
    return tokenSet;
  }

  private _reportOBJ_DeclarationLine(lineNbr: number, startingOffset: number, line: string): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    //skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const remainingNonCommentLineStr: string = this._getNonCommentLineReturnComment(currentOffset, lineNbr, line, tokenSet);
    //this._logOBJ('- RptObjDecl remainingNonCommentLineStr=[' + remainingNonCommentLineStr + ']');
    const remainingLength: number = remainingNonCommentLineStr.length;
    if (remainingLength > 0) {
      // get line parts - initially, we only care about first one
      const lineParts: string[] = remainingNonCommentLineStr.split(/[ \t\:\[]/);
      this._logOBJ("  --  OBJ lineParts=[" + lineParts + "]");
      const objectName = lineParts[0];
      // object name token must be offset into full line for token
      const nameOffset: number = line.indexOf(objectName, currentOffset);
      tokenSet.push({
        line: lineNbr,
        startCharacter: nameOffset,
        length: objectName.length,
        ptTokenType: "namespace",
        ptTokenModifiers: ["declaration"],
      });
      const objArrayOpen: number = remainingNonCommentLineStr.indexOf("[");
      if (objArrayOpen != -1) {
        // we have an array of objects, study the index value for possible named reference(s)
        const objArrayClose: number = remainingNonCommentLineStr.indexOf("]");
        if (objArrayClose != -1) {
          const elemCountStr: string = remainingNonCommentLineStr.substr(objArrayOpen + 1, objArrayClose - objArrayOpen - 1);
          // if we have a variable name...
          if (elemCountStr.substr(0, 1).match(/[a-zA-Z_]/)) {
            let possibleNameSet: string[] = [];
            const hasOpenParen: boolean = elemCountStr.indexOf("(") != -1; // should never be, but must check
            // is it a namespace reference?
            if (elemCountStr.includes(".")) {
              possibleNameSet = elemCountStr.split(".");
            } else {
              possibleNameSet = [elemCountStr];
            }
            for (let index = 0; index < possibleNameSet.length; index++) {
              const nameReference = possibleNameSet[index];
              if (this.semanticFindings.isGlobalToken(nameReference)) {
                const referenceDetails: RememberedToken | undefined = this.semanticFindings.getGlobalToken(nameReference);
                // Token offsets must be line relative so search entire line...
                const nameOffset = line.indexOf(nameReference, currentOffset);
                if (referenceDetails != undefined) {
                  //const updatedModificationSet: string[] = this._modifiersWithout(referenceDetails.modifiers, "declaration");
                  this._logOBJ("  --  FOUND global name=[" + nameReference + "]");
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: nameReference.length,
                    ptTokenType: referenceDetails.type,
                    ptTokenModifiers: referenceDetails.modifiers,
                  });
                }
              } else {
                // have possible dotted reference with name in other object. if has to be a constant
                if (!hasOpenParen) {
                  this._logOBJ("  --  OBJ Constant in external object name=[" + nameReference + "]");
                  const nameOffset = line.indexOf(nameReference, currentOffset);
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: nameReference.length,
                    ptTokenType: "variable",
                    ptTokenModifiers: ["readonly"],
                  });
                }
                // we don't have name registered so just mark it
                else if (!this.parseUtils.isSpinReservedWord(nameReference) && !this.parseUtils.isBuiltinReservedWord(nameReference)) {
                  this._logOBJ("  --  OBJ MISSING name=[" + nameReference + "]");
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: nameReference.length,
                    ptTokenType: "variable",
                    ptTokenModifiers: ["missingDeclaration"],
                  });
                }
              }
            }
          }
        }
      }
    }
    return tokenSet;
  }

  private _reportVAR_DeclarationLine(lineNbr: number, startingOffset: number, line: string): IParsedToken[] {
    const tokenSet: IParsedToken[] = [];
    //skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const remainingNonCommentLineStr: string = this._getNonCommentLineReturnComment(currentOffset, lineNbr, line, tokenSet);
    if (remainingNonCommentLineStr.length > 0) {
      // get line parts - we only care about first one
      let lineParts: string[] = this.parseUtils.getCommaDelimitedNonWhiteLineParts(remainingNonCommentLineStr);
      this._logVAR("  -- rptVarDecl lineParts=[" + lineParts + "]");
      // remember this object name so we can annotate a call to it
      const isMultiDeclaration: boolean = remainingNonCommentLineStr.includes(",");
      const hasStorageType: boolean = this.parseUtils.isStorageType(lineParts[0]);
      if (lineParts.length > 1) {
        const startIndex: number = hasStorageType ? 1 : 0;
        for (let index = startIndex; index < lineParts.length; index++) {
          let newName = lineParts[index];
          const hasArrayReference: boolean = newName.indexOf("[") != -1;
          if (hasArrayReference) {
            // remove array suffix from name
            if (newName.includes("[")) {
              const nameParts: string[] = newName.split("[");
              newName = nameParts[0];
            }
          }
          // in the following, let's not register a name with a trailing ']' this is part of an array size calculation!
          if (newName.substr(0, 1).match(/[a-zA-Z_]/) && newName.indexOf("]") == -1) {
            this._logVAR("  -- GLBL ADD rvdl newName=[" + newName + "]");
            const nameOffset: number = line.indexOf(newName, currentOffset);
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: newName.length,
              ptTokenType: "variable",
              ptTokenModifiers: ["declaration", "instance"],
            });
            currentOffset = nameOffset + newName.length;
          }
          if (hasArrayReference) {
            // process name with array length value
            const arrayOpenOffset: number = line.indexOf("[", currentOffset);
            const arrayCloseOffset: number = line.indexOf("]", currentOffset);
            const arrayReference: string = line.substr(arrayOpenOffset + 1, arrayCloseOffset - arrayOpenOffset - 1);
            const arrayReferenceParts: string[] = arrayReference.split(/[ \t\/\*\+\<\>]/);
            this._logVAR("  --  arrayReferenceParts=[" + arrayReferenceParts + "](" + arrayReferenceParts.length + ")");
            for (let index = 0; index < arrayReferenceParts.length; index++) {
              const referenceName = arrayReferenceParts[index];
              if (referenceName.substr(0, 1).match(/[a-zA-Z_]/)) {
                let possibleNameSet: string[] = [];
                // is it a namespace reference?
                if (referenceName.includes("#")) {
                  possibleNameSet = referenceName.split("#");
                } else {
                  possibleNameSet = [referenceName];
                }
                this._logVAR("  --  possibleNameSet=[" + possibleNameSet + "](" + possibleNameSet.length + ")");
                const namePart = possibleNameSet[0];
                if (this.semanticFindings.isGlobalToken(namePart)) {
                  const referenceDetails: RememberedToken | undefined = this.semanticFindings.getGlobalToken(namePart);
                  const searchString: string = possibleNameSet.length == 1 ? possibleNameSet[0] : possibleNameSet[0] + "#" + possibleNameSet[1];
                  const nameOffset = line.indexOf(searchString, currentOffset);
                  if (referenceDetails != undefined) {
                    this._logVAR("  --  FOUND global name=[" + namePart + "]");
                    tokenSet.push({
                      line: lineNbr,
                      startCharacter: nameOffset,
                      length: namePart.length,
                      ptTokenType: referenceDetails.type,
                      ptTokenModifiers: referenceDetails.modifiers,
                    });
                  } else {
                    // we don't have name registered so just mark it
                    if (!this.parseUtils.isSpinReservedWord(namePart) && !this.parseUtils.isBuiltinReservedWord(namePart)) {
                      this._logVAR("  --  VAR Add MISSING name=[" + namePart + "]");
                      tokenSet.push({
                        line: lineNbr,
                        startCharacter: nameOffset,
                        length: namePart.length,
                        ptTokenType: "variable",
                        ptTokenModifiers: ["missingDeclaration"],
                      });
                    }
                  }
                }
                if (possibleNameSet.length > 1) {
                  // we have .constant namespace suffix
                  this._logVAR("  --  VAR Add ReadOnly name=[" + namePart + "]");
                  const constantPart: string = possibleNameSet[1];
                  const nameOffset = line.indexOf(constantPart, currentOffset);
                  tokenSet.push({
                    line: lineNbr,
                    startCharacter: nameOffset,
                    length: constantPart.length,
                    ptTokenType: "variable",
                    ptTokenModifiers: ["readonly"],
                  });
                }
              }
            }
          }
        }
      } else {
        // have single declaration per line
        let newName = lineParts[0];
        if (newName.substr(0, 1).match(/[a-zA-Z_]/)) {
          this._logVAR("  -- GLBL rvdl2 newName=[" + newName + "]");
          const nameOffset: number = line.indexOf(newName, currentOffset);
          tokenSet.push({
            line: lineNbr,
            startCharacter: nameOffset,
            length: newName.length,
            ptTokenType: "variable",
            ptTokenModifiers: ["declaration", "instance"],
          });
        }
      }
    }
    return tokenSet;
  }

  private _reportObjectReference(dotReference: string, lineNbr: number, startingOffset: number, line: string, tokenSet: IParsedToken[]): boolean {
    this._logDEBUG("  --  rOr dotReference=[" + dotReference + "]");
    let possibleNameSet: string[] = [];
    let bGeneratedReference: boolean = false;
    if (dotReference.includes(".")) {
      const symbolOffset: number = line.indexOf(dotReference, startingOffset); // walk this past each
      possibleNameSet = dotReference.split(".");
      const namePart = possibleNameSet[0];
      let referenceDetails: RememberedToken | undefined = undefined;
      if (this.semanticFindings.isGlobalToken(namePart)) {
        referenceDetails = this.semanticFindings.getGlobalToken(namePart);
        this._logPASM("  --  FOUND global name=[" + namePart + "]");
      }
      if (referenceDetails != undefined) {
        //this._logPASM('  --  Debug() colorize name=[' + newParameter + ']');
        bGeneratedReference = true;
        tokenSet.push({
          line: lineNbr,
          startCharacter: symbolOffset,
          length: namePart.length,
          ptTokenType: referenceDetails.type,
          ptTokenModifiers: referenceDetails.modifiers,
        });
        if (possibleNameSet.length > 1) {
          // we have .constant namespace suffix
          // determine if this is method has '(' or constant name
          const refPart = possibleNameSet[1];
          const referenceOffset = line.indexOf(refPart, symbolOffset + namePart.length + 1);
          let isMethod: boolean = false;
          if (line.substr(referenceOffset + refPart.length, 1) == "(") {
            isMethod = true;
          }
          const constantPart: string = possibleNameSet[1];
          if (this.parseUtils.isStorageType(constantPart)) {
            // FIXME: UNDONE remove when syntax see this correctly
            const nameOffset: number = line.indexOf(constantPart, referenceOffset + refPart.length + 1);
            this._logSPIN("  --  rOr rhs storageType=[" + constantPart + "](" + (nameOffset + 1) + ")");
            tokenSet.push({
              line: lineNbr,
              startCharacter: nameOffset,
              length: constantPart.length,
              ptTokenType: "storageType",
              ptTokenModifiers: [],
            });
          } else {
            const tokenTypeID: string = isMethod ? "method" : "variable";
            const tokenModifiers: string[] = isMethod ? [] : ["readonly"];
            this._logSPIN("  --  rOr rhs constant=[" + constantPart + "](" + (referenceOffset + 1) + ") (" + tokenTypeID + ")");
            tokenSet.push({
              line: lineNbr,
              startCharacter: referenceOffset,
              length: refPart.length,
              ptTokenType: tokenTypeID,
              ptTokenModifiers: tokenModifiers,
            });
          }
        }
      }
    }
    return bGeneratedReference;
  }

  private _getSingleQuotedString(currentOffset: number, searchText: string): string {
    let nextString: string = "";
    const stringStartOffset: number = searchText.indexOf("'", currentOffset);
    if (stringStartOffset != -1) {
      this._logDEBUG("  -- _getSingleQuotedString(" + currentOffset + ", [" + searchText + "])");
      const stringEndOffset: number = searchText.indexOf("'", stringStartOffset + 1);
      if (stringEndOffset != -1) {
        nextString = searchText.substring(stringStartOffset, stringEndOffset + 1);
      }
    }
    if (nextString.length > 0) {
      this._logDEBUG("  -- gsqs nextString=[" + nextString + "](" + nextString.length + ")");
    }
    return nextString;
  }

  private _getDoubleQuotedString(currentOffset: number, searchText: string): string {
    let nextString: string = "";
    const chrDoubleQuote: string = '"';
    const stringStartOffset: number = searchText.indexOf(chrDoubleQuote, currentOffset);
    if (stringStartOffset != -1) {
      this._logDEBUG("  -- _getDoubleQuotedString(" + currentOffset + ", [" + searchText + "])");
      const stringEndOffset: number = searchText.indexOf(chrDoubleQuote, stringStartOffset + 1);
      if (stringEndOffset != -1) {
        nextString = searchText.substring(stringStartOffset, stringEndOffset + 1);
      }
    }
    if (nextString.length > 0) {
      this._logDEBUG("  -- gdqs nextString=[" + nextString + "](" + nextString.length + ")");
    }
    return nextString;
  }

  private _logTokenSet(message: string): void {
    if (this.logTokenDiscover) {
      this._logMessage(message);
    }
  }

  private _logState(message: string): void {
    if (this.showState) {
      this._logMessage(message);
    }
  }

  private _logSPIN(message: string): void {
    if (this.showSpinCode) {
      this._logMessage(message);
    }
  }

  private _logPreProc(message: string): void {
    if (this.showPreProc) {
      this._logMessage(message);
    }
  }

  private _logCON(message: string): void {
    if (this.showCON) {
      this._logMessage(message);
    }
  }

  private _logVAR(message: string): void {
    if (this.showVAR) {
      this._logMessage(message);
    }
  }

  private _logDAT(message: string): void {
    if (this.showDAT) {
      this._logMessage(message);
    }
  }

  private _logOBJ(message: string): void {
    if (this.showOBJ) {
      this._logMessage(message);
    }
  }

  private _logPASM(message: string): void {
    if (this.showPasmCode) {
      this._logMessage(message);
    }
  }

  private _logMessage(message: string): void {
    if (this.spin1log != undefined) {
      //Write to output window.
      this.spin1log.appendLine(message);
    }
  }

  private _logDEBUG(message: string): void {
    if (this.showDEBUG) {
      this._logMessage(message);
    }
  }

  private _isSectionStartLine(line: string): {
    isSectionStart: boolean;
    inProgressStatus: eParseState;
  } {
    // return T/F where T means our string starts a new section!
    let startStatus: boolean = false;
    let inProgressState: eParseState = eParseState.Unknown;
    if (line.length > 2) {
      const lineParts: string[] = line.split(/[ \t]/);
      if (lineParts.length > 0) {
        const sectionName: string = lineParts[0].toUpperCase();
        startStatus = true;
        if (sectionName === "CON") {
          inProgressState = eParseState.inCon;
        } else if (sectionName === "DAT") {
          inProgressState = eParseState.inDat;
        } else if (sectionName === "OBJ") {
          inProgressState = eParseState.inObj;
        } else if (sectionName === "PUB") {
          inProgressState = eParseState.inPub;
        } else if (sectionName === "PRI") {
          inProgressState = eParseState.inPri;
        } else if (sectionName === "VAR") {
          inProgressState = eParseState.inVar;
        } else {
          startStatus = false;
        }
      }
    }
    if (startStatus) {
      this._logMessage("** isSectStart line=[" + line + "]");
    }
    return {
      isSectionStart: startStatus,
      inProgressStatus: inProgressState,
    };
  }

  private _getNonWhiteSpinLineParts(line: string): IFilteredStrings {
    //                                     split(/[ \t\-\:\,\+\[\]\@\(\)\!\*\=\<\>\&\|\?\\\~\#\^\/]/);
    const nonEqualsLine: string = this.parseUtils.removeDoubleQuotedStrings(line);
    let lineParts: string[] | null = nonEqualsLine.match(/[^ \t\-\:\,\+\[\]\@\(\)\!\*\=\<\>\&\|\?\\\~\^\/]+/g);
    if (lineParts === null) {
      lineParts = [];
    }
    return {
      lineNoQuotes: nonEqualsLine,
      lineParts: lineParts,
    };
  }

  private _getNonCommentLineReturnComment(startingOffset: number, lineNbr: number, line: string, tokenSet: IParsedToken[]): string {
    // skip Past Whitespace
    let currentOffset: number = this.parseUtils.skipWhite(line, startingOffset);
    const nonCommentLHSStr = this.parseUtils.getNonCommentLineRemainder(currentOffset, line);
    // now record the comment if we have one
    const commentRHSStrOffset: number = currentOffset + nonCommentLHSStr.length;
    const commentOffset: number = line.indexOf("'", commentRHSStrOffset);
    const bHaveDocComment: boolean = line.indexOf("''", commentOffset) != -1;
    if (commentOffset != -1 && !bHaveDocComment) {
      const newToken: IParsedToken = {
        line: lineNbr,
        startCharacter: commentOffset,
        length: line.length - commentOffset + 1,
        ptTokenType: "comment",
        ptTokenModifiers: ["line"],
      };
      tokenSet.push(newToken);
    }
    return nonCommentLHSStr;
  }

  private _tokenString(aToken: IParsedToken, line: string): string {
    let varName: string = line.substr(aToken.startCharacter, aToken.length);
    let desiredInterp: string =
      "  -- token=[ln:" + (aToken.line + 1) + ",ofs:" + aToken.startCharacter + ",len:" + aToken.length + " [" + varName + "](" + aToken.ptTokenType + "[" + aToken.ptTokenModifiers + "])]";
    return desiredInterp;
  }

  private _rememberdTokenString(tokenName: string, aToken: RememberedToken | undefined): string {
    let desiredInterp: string = "  -- token=[len:" + tokenName.length + " [" + tokenName + "](undefined)";
    if (aToken != undefined) {
      desiredInterp = "  -- token=[len:" + tokenName.length + " [" + tokenName + "](" + aToken.type + "[" + aToken.modifiers + "])]";
    }
    return desiredInterp;
  }

  private _checkTokenSet(tokenSet: IParsedToken[]): void {
    this._logMessage("\n---- Checking " + tokenSet.length + " tokens. ----");
    tokenSet.forEach((parsedToken) => {
      if (parsedToken.length == undefined || parsedToken.startCharacter == undefined) {
        this._logMessage("- BAD Token=[" + parsedToken + "]");
      }
    });
    this._logMessage("---- Check DONE ----\n");
  }
}
