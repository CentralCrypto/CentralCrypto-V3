
import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { CircleDashed, RefreshCw, ChevronDown, X } from 'lucide-react';
import { fetchTopCoins } from '../../../services/api';
import { DashboardItem, Language, ApiCoin } from '../../../types';
