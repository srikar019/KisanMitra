import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { onPendingRequestsSnapshot } from '../services/connectionService';
import { onDealRequestsSnapshot, onDealNotificationsSnapshot } from '../services/marketplaceService';
import { onPendingAgriSwapRequestsSnapshot, onFinalizedAgriSwapDealsSnapshot } from '../services/barterService';
import { onAlertsSnapshot } from '../services/alertService';
import { ConnectionRequest, DealRequest, DealNotification, ChatNotification, Alert, AgriSwapDealRequest, FinalizedAgriSwapDeal } from '../types';
import { firestore } from '../services/firebase';

interface NotificationContextType {
  pendingRequests: ConnectionRequest[];
  dealRequests: DealRequest[];
  dealNotifications: DealNotification[];
  chatNotifications: ChatNotification[];
  alerts: Alert[];
  agriSwapDealRequests: AgriSwapDealRequest[];
  finalizedAgriSwapDeals: FinalizedAgriSwapDeal[];
  requestCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [dealRequests, setDealRequests] = useState<DealRequest[]>([]);
  const [dealNotifications, setDealNotifications] = useState<DealNotification[]>([]);
  const [chatNotifications, setChatNotifications] = useState<ChatNotification[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [agriSwapDealRequests, setAgriSwapDealRequests] = useState<AgriSwapDealRequest[]>([]);
  const [finalizedAgriSwapDeals, setFinalizedAgriSwapDeals] = useState<FinalizedAgriSwapDeal[]>([]);


  useEffect(() => {
    let unsubConnections: (() => void) | undefined;
    let unsubDeals: (() => void) | undefined;
    let unsubDealAuths: (() => void) | undefined;
    let unsubChats: (() => void) | undefined;
    let unsubAlerts: (() => void) | undefined;
    let unsubAgriSwapRequests: (() => void) | undefined;
    let unsubFinalizedDeals: (() => void) | undefined;

    if (currentUser) {
      unsubConnections = onPendingRequestsSnapshot(currentUser.uid, setPendingRequests);
      unsubDeals = onDealRequestsSnapshot(currentUser.uid, setDealRequests);
      unsubDealAuths = onDealNotificationsSnapshot(currentUser.uid, setDealNotifications);
      unsubAlerts = onAlertsSnapshot(currentUser.uid, setAlerts);
      unsubAgriSwapRequests = onPendingAgriSwapRequestsSnapshot(currentUser.uid, setAgriSwapDealRequests);
      unsubFinalizedDeals = onFinalizedAgriSwapDealsSnapshot(currentUser.uid, setFinalizedAgriSwapDeals);

      const chatsQuery = firestore.collection('chats')
          .where('participants', 'array-contains', currentUser.uid);
      
      unsubChats = chatsQuery.onSnapshot(snapshot => {
          const newNotifications: ChatNotification[] = [];
          snapshot.docs.forEach(doc => {
              const data = doc.data();
              const lastMessage = data.lastMessage;
              const participantInfo = data.participantInfo?.[currentUser.uid];

              if (lastMessage && lastMessage.senderUid && lastMessage.senderUid !== currentUser.uid) {
                  const messageTimestamp = lastMessage.timestamp?.toDate();
                  const lastReadTimestamp = participantInfo?.lastRead?.toDate();
                  
                  if (!lastReadTimestamp || (messageTimestamp && messageTimestamp > lastReadTimestamp)) {
                      newNotifications.push({
                          id: doc.id,
                          senderUid: lastMessage.senderUid,
                          senderEmail: lastMessage.senderEmail,
                          text: lastMessage.text,
                          timestamp: messageTimestamp || new Date()
                      });
                  }
              }
          });
          setChatNotifications(newNotifications);
      });


    } else {
      setPendingRequests([]);
      setDealRequests([]);
      setDealNotifications([]);
      setChatNotifications([]);
      setAlerts([]);
      setAgriSwapDealRequests([]);
      setFinalizedAgriSwapDeals([]);
    }

    return () => {
      if (unsubConnections) unsubConnections();
      if (unsubDeals) unsubDeals();
      if (unsubDealAuths) unsubDealAuths();
      if (unsubChats) unsubChats();
      if (unsubAlerts) unsubAlerts();
      if (unsubAgriSwapRequests) unsubAgriSwapRequests();
      if (unsubFinalizedDeals) unsubFinalizedDeals();
    };
  }, [currentUser]);

  const value = {
    pendingRequests,
    dealRequests,
    dealNotifications,
    chatNotifications,
    alerts,
    agriSwapDealRequests,
    finalizedAgriSwapDeals,
    requestCount: pendingRequests.length + dealRequests.length + dealNotifications.length + chatNotifications.length + alerts.length + agriSwapDealRequests.length + finalizedAgriSwapDeals.length,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
